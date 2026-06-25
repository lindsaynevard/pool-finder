// Gmail scraper for pool closure notices
// Reads poolfinderalerts@gmail.com inbox via Gmail API and writes
// closureNotice strings to matching Firestore schedule documents.
import { google } from 'googleapis';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { dateStr } from './utils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const creds = JSON.parse(readFileSync(path.join(__dirname, 'gmail-credentials.json')));
const { client_id, client_secret } = creds.installed;

const auth = new google.auth.OAuth2(client_id, client_secret, 'http://localhost:3333');
auth.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });
const gmail = google.gmail({ version: 'v1', auth });

// Map sender domains/addresses to pool IDs
const POOL_SENDERS = [
  { match: 'emeryville',          poolIds: ['emeryville'] },
  { match: 'berkeleyca.gov',      poolIds: ['west-campus', 'king'] },
  { match: 'albanyaquaticcenter', poolIds: ['albany-indoor', 'albany-outdoor'] },
  { match: 'piedmont',            poolIds: ['piedmont'] },
  { match: 'elcerrito',           poolIds: ['el-cerrito-splash'] },
];

const CLOSURE_KEYWORDS = [
  'closed',
  'closure',
  'cancelled',
  'canceled',
  'no lap swim',
  'pool will be closed',
  'not available',
];

// Decode a base64url-encoded Gmail message part body
function decodeBody(encoded) {
  if (!encoded) return '';
  const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(base64, 'base64').toString('utf-8');
}

// Recursively extract text body from a MIME message part
function extractText(part) {
  if (!part) return '';
  if (part.mimeType === 'text/plain' && part.body?.data) {
    return decodeBody(part.body.data);
  }
  if (part.parts) {
    for (const child of part.parts) {
      const text = extractText(child);
      if (text) return text;
    }
  }
  return '';
}

// Pull the first sentence or line that contains a closure keyword, capped at 120 chars
function extractNotice(body, keyword) {
  const lower = body.toLowerCase();
  const idx = lower.indexOf(keyword.toLowerCase());
  if (idx === -1) return null;

  // Take the surrounding sentence: look back to start of sentence, forward to end
  const sentenceStart = Math.max(0, body.lastIndexOf('.', idx - 1) + 1);
  const sentenceEndDot  = body.indexOf('.', idx);
  const sentenceEndNl   = body.indexOf('\n', idx);
  let sentenceEnd = -1;
  if (sentenceEndDot !== -1 && sentenceEndNl !== -1) sentenceEnd = Math.min(sentenceEndDot, sentenceEndNl);
  else if (sentenceEndDot !== -1) sentenceEnd = sentenceEndDot;
  else if (sentenceEndNl !== -1) sentenceEnd = sentenceEndNl;

  const raw = sentenceEnd !== -1
    ? body.slice(sentenceStart, sentenceEnd + 1)
    : body.slice(sentenceStart, sentenceStart + 120);

  return raw.trim().slice(0, 120);
}

// Month name -> 0-based month number
const MONTH_MAP = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
  jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6, aug: 7,
  sep: 8, oct: 9, nov: 10, dec: 11,
};

// Try to extract specific dates mentioned in the email body.
// Returns an array of Date objects. Falls back to today + next 3 days if none found.
function extractDates(body) {
  const found = [];
  const now = new Date();
  const year = now.getFullYear();

  // "June 25", "July 4th", "June 25, 2026"
  const wordDateRe = /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(\d{4}))?\b/gi;
  let m;
  while ((m = wordDateRe.exec(body)) !== null) {
    const month = MONTH_MAP[m[1].toLowerCase()];
    const day = parseInt(m[2]);
    const yr = m[3] ? parseInt(m[3]) : year;
    if (month !== undefined && day >= 1 && day <= 31) {
      found.push(new Date(yr, month, day));
    }
  }

  // "6/25" or "6/25/2026"
  const numericDateRe = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/g;
  while ((m = numericDateRe.exec(body)) !== null) {
    const month = parseInt(m[1]) - 1;
    const day = parseInt(m[2]);
    let yr = m[3] ? parseInt(m[3]) : year;
    if (yr < 100) yr += 2000;
    if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
      found.push(new Date(yr, month, day));
    }
  }

  // "tomorrow"
  if (/\btomorrow\b/i.test(body)) {
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    found.push(tomorrow);
  }

  // Deduplicate by YYYY-MM-DD string
  const seen = new Set();
  const unique = found.filter(d => {
    const s = dateStr(d);
    if (seen.has(s)) return false;
    seen.add(s);
    return true;
  });

  if (unique.length > 0) return unique;

  // Fallback: today + next 3 days
  const fallback = [];
  for (let i = 0; i < 4; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    fallback.push(d);
  }
  return fallback;
}

// Match a sender string (From header) to pool IDs
function matchSender(from) {
  const lower = from.toLowerCase();
  for (const entry of POOL_SENDERS) {
    if (lower.includes(entry.match)) return entry.poolIds;
  }
  return null;
}

export async function scrapeGmail() {
  if (!process.env.GMAIL_REFRESH_TOKEN) {
    console.warn('  GMAIL_REFRESH_TOKEN not set — skipping Gmail scraper.');
    return {};
  }

  const results = {};

  // Fetch message IDs from the last 7 days
  let messageIds = [];
  try {
    const listRes = await gmail.users.messages.list({
      userId: 'me',
      q: 'newer_than:7d',
      maxResults: 100,
    });
    messageIds = listRes.data.messages ?? [];
  } catch (err) {
    console.warn(`  Gmail list error: ${err.message}`);
    return {};
  }

  if (messageIds.length === 0) {
    console.log('  No messages found in the last 7 days.');
    return {};
  }

  for (const { id } of messageIds) {
    let msg;
    try {
      const msgRes = await gmail.users.messages.get({
        userId: 'me',
        id,
        format: 'full',
      });
      msg = msgRes.data;
    } catch (err) {
      console.warn(`  Could not fetch message ${id}: ${err.message}`);
      continue;
    }

    // Get the From header
    const headers = msg.payload?.headers ?? [];
    const fromHeader = headers.find(h => h.name.toLowerCase() === 'from');
    const from = fromHeader?.value ?? '';

    const poolIds = matchSender(from);
    if (!poolIds) continue; // Not a known sender

    // Decode message body
    const body = extractText(msg.payload);
    if (!body) continue;

    const lowerBody = body.toLowerCase();
    const matchedKeyword = CLOSURE_KEYWORDS.find(kw => lowerBody.includes(kw.toLowerCase()));
    if (!matchedKeyword) continue; // No closure signal

    const notice = extractNotice(body, matchedKeyword);
    if (!notice) continue;

    const dates = extractDates(body);

    for (const poolId of poolIds) {
      for (const d of dates) {
        const ds = dateStr(d);
        const key = `${poolId}_${ds}`;
        // Keep the first (most specific) notice found per key
        if (!results[key]) {
          results[key] = { closureNotice: notice };
        }
      }
    }
  }

  return results;
}
