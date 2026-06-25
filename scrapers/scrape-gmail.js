// Gmail scraper for pool closure notices
// Reads poolfinderalerts@gmail.com inbox via Gmail API and writes
// closureNotice strings to matching Firestore schedule documents.
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { dateStr } from './utils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const creds = JSON.parse(readFileSync(path.join(__dirname, 'gmail-credentials.json')));
const { client_id, client_secret } = creds.installed;

// Refresh the access token manually using Node's built-in fetch
async function getAccessToken() {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id,
      client_secret,
      refresh_token: process.env.GMAIL_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }).toString(),
  });
  if (!res.ok) throw new Error(`Token refresh failed: ${res.status} ${await res.text()}`);
  const { access_token } = await res.json();
  return access_token;
}

// Call the Gmail REST API directly with the access token
async function gmailGet(path, accessToken) {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Gmail API ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

// Map sender domains/addresses to pool IDs
const POOL_SENDERS = [
  { match: 'emeryville',          poolIds: ['emeryville'] },
  { match: 'berkeleyca.gov',      poolIds: ['west-campus', 'king'] },
  { match: 'ausdk12.org',         poolIds: ['albany-indoor', 'albany-outdoor'] },
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

// Return the first line (split on \n or sentence boundary) that contains the
// closure keyword. Falls back to a 120-char window around the keyword if the
// body has no newlines (e.g. a single-line plain-text dump).
function extractNotice(body, keyword) {
  const lower = body.toLowerCase();
  const kw = keyword.toLowerCase();
  if (!lower.includes(kw)) return null;

  // Prefer splitting on newlines — each line is a natural unit in plain-text email.
  const lines = body.split('\n');
  const noticeLine = lines.find(l => l.toLowerCase().includes(kw));
  if (noticeLine) return noticeLine.trim().slice(0, 120);

  // Fallback: 120-char window centred on the keyword
  const idx = lower.indexOf(kw);
  return body.slice(Math.max(0, idx - 20), idx + 100).trim().slice(0, 120);
}

// Month name -> 0-based month number
const MONTH_MAP = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
  jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6, aug: 7,
  sep: 8, oct: 9, nov: 10, dec: 11,
};

// Try to extract specific dates mentioned in the email body.
// Only returns dates within the next 14 days (the schedule window).
// Returns an empty array if no in-window dates are found — caller should skip.
function extractDates(body) {
  const found = [];
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const year = now.getFullYear();
  const windowEnd = new Date(now);
  windowEnd.setDate(now.getDate() + 14);

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

  // Only keep dates within the 14-day schedule window
  const inWindow = found.filter(d => d >= now && d <= windowEnd);

  // Deduplicate by YYYY-MM-DD string
  const seen = new Set();
  return inWindow.filter(d => {
    const s = dateStr(d);
    if (seen.has(s)) return false;
    seen.add(s);
    return true;
  });
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

  // Get a fresh access token
  let accessToken;
  try {
    accessToken = await getAccessToken();
  } catch (err) {
    console.warn(`  Gmail auth error: ${err.message}`);
    return {};
  }

  // Fetch message IDs from the last 7 days
  let messageIds = [];
  try {
    const listRes = await gmailGet('messages?q=newer_than%3A7d&maxResults=100', accessToken);
    messageIds = listRes.messages ?? [];
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
      msg = await gmailGet(`messages/${id}?format=full`, accessToken);
    } catch (err) {
      console.warn(`  Could not fetch message ${id}: ${err.message}`);
      continue;
    }

    // Get the From header
    const headers = msg.payload?.headers ?? [];
    const fromHeader = headers.find(h => h.name.toLowerCase() === 'from');
    const from = fromHeader?.value ?? '';

    const poolIds = matchSender(from);
    if (!poolIds) { console.log(`  [debug] no sender match: ${from.slice(0, 60)}`); continue; }

    console.log(`  [debug] matched sender: ${from.slice(0, 60)} → ${poolIds}`);

    // Decode message body
    const body = extractText(msg.payload);
    if (!body) { console.log(`  [debug] empty body (HTML-only email?)`); continue; }

    console.log(`  [debug] body length: ${body.length}, first 120: ${body.slice(0, 120).replace(/\n/g, '\\n')}`);

    const lowerBody = body.toLowerCase();
    const matchedKeyword = CLOSURE_KEYWORDS.find(kw => lowerBody.includes(kw.toLowerCase()));
    if (!matchedKeyword) { console.log(`  [debug] no closure keyword found`); continue; }

    console.log(`  [debug] matched keyword: "${matchedKeyword}"`);

    const notice = extractNotice(body, matchedKeyword);
    if (!notice) { console.log(`  [debug] extractNotice returned null`); continue; }

    console.log(`  [debug] notice: "${notice}"`);

    // Sanity check: the extracted notice sentence must itself contain a closure keyword.
    const noticeLower = notice.toLowerCase();
    const noticeHasKeyword = CLOSURE_KEYWORDS.some(kw => noticeLower.includes(kw.toLowerCase()));
    if (!noticeHasKeyword) { console.log(`  [debug] notice failed sanity check (no keyword in notice)`); continue; }

    const dates = extractDates(body);
    console.log(`  [debug] in-window dates: ${dates.map(d => d.toISOString().slice(0,10)).join(', ') || 'none'}`);
    if (dates.length === 0) continue;

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
