// Scraper for Emeryville ECCL lap swim
// Fetches the live schedule page and uses Claude AI to parse it.
// Caches the parsed schedule by page hash — only re-parses when the page changes.
// Cache: scrapers/.emeryville-schedule-cache.json

import * as cheerio from 'cheerio';
import Anthropic from '@anthropic-ai/sdk';
import { createHash } from 'crypto';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { dateStr } from './utils.js';

const URL = 'https://www.emeryville.org/Recreation/Fitness/Aquatics/Swim-For-Fitness';
const CACHE_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '.emeryville-schedule-cache.json');
const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const PARSE_PROMPT = `You are parsing the Emeryville ECCL pool schedule from a webpage.
Return ONLY valid JSON — no explanation, no markdown, just the JSON object.

The schedule is organized into date-range periods (e.g. "June 6 – June 21, 2026").
Each period has sessions that vary by day of week.
Modified hours for specific dates (e.g. swim meets) may be listed separately.

Rules:
- Time format: "6:00 AM", "10:00 AM", "1:30 PM" (always include AM/PM, no leading zero on hour).
- All sessions are type "lap".
- "validFrom" and "validUntil": from the period header. Format: "YYYY-MM-DD". Use the current year if no year is given.
- "closedDates": from closure/holiday listings. Format: "YYYY-MM-DD".
- "modifiedDates": specific dates with different hours than their weekday pattern. Include date and the full session list for that day.
- Expand day ranges ("Mon–Thu") into individual day keys in "weekly".
- If a period has no Friday-specific hours listed, Friday uses the weekday sessions.

Return this exact JSON shape:
{
  "periods": [
    {
      "validFrom": "YYYY-MM-DD",
      "validUntil": "YYYY-MM-DD",
      "weekly": {
        "monday":    [{ "start": "H:MM AM", "end": "H:MM PM", "type": "lap", "notes": null }],
        "tuesday":   [...],
        "wednesday": [...],
        "thursday":  [...],
        "friday":    [...],
        "saturday":  [...],
        "sunday":    [...]
      },
      "closedDates": ["YYYY-MM-DD"],
      "modifiedDates": [
        { "date": "YYYY-MM-DD", "sessions": [{ "start": "...", "end": "...", "type": "lap", "notes": "..." }] }
      ]
    }
  ]
}`;

function extractScheduleText(html) {
  const $ = cheerio.load(html);
  // Remove nav, footer, scripts, styles — keep main content
  $('nav, footer, script, style, header').remove();
  return $('body').text().replace(/\s+/g, ' ').trim();
}

async function parseWithClaude(pageText) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const year = new Date().getFullYear();

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    messages: [{
      role: 'user',
      content: `Current year: ${year}\n\n${PARSE_PROMPT}\n\nPage text to parse:\n\n${pageText}`,
    }],
  });

  const raw = message.content[0].text.trim();
  const clean = raw.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
  return JSON.parse(clean);
}

function warnIfExpiringSoon(schedule) {
  if (!schedule?.periods?.length) return;
  const today = new Date().toISOString().slice(0, 10);
  const maxUntil = schedule.periods.map(p => p.validUntil).filter(Boolean).sort().at(-1);
  if (!maxUntil) return;
  const daysLeft = Math.ceil((new Date(maxUntil) - new Date(today)) / 86400000);
  if (daysLeft <= 21) {
    console.warn(`  ⚠️  Emeryville cache expires in ${daysLeft} day(s) (${maxUntil}).`);
    console.warn(`      Emeryville.org blocks CI IPs — update .emeryville-schedule-cache.json manually before it expires.`);
  }
}

function buildResults(schedule, daysAhead) {
  const results = {};
  const pacificDate = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
  const [py, pm, pd] = pacificDate.split('-').map(Number);
  const base = new Date(py, pm - 1, pd);

  const allClosed = new Set(schedule.periods.flatMap(p => p.closedDates || []));

  for (let i = 0; i < daysAhead; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    const ds = dateStr(d);

    if (allClosed.has(ds)) {
      results[`emeryville_${ds}`] = {
        poolId: 'emeryville', date: ds, sessions: [],
        closureNotice: 'Closed — see emeryville.org for details',
        lastUpdated: new Date().toISOString(),
      };
      continue;
    }

    const period = schedule.periods.find(p => ds >= p.validFrom && ds <= p.validUntil);
    if (!period) continue;

    // Check for a modified date override first
    const modified = period.modifiedDates?.find(m => m.date === ds);
    if (modified) {
      results[`emeryville_${ds}`] = {
        poolId: 'emeryville', date: ds,
        sessions: modified.sessions,
        closureNotice: null,
        lastUpdated: new Date().toISOString(),
      };
      continue;
    }

    const day = DAYS[d.getDay()];
    const sessions = period.weekly[day] || [];
    if (sessions.length === 0) continue;

    results[`emeryville_${ds}`] = {
      poolId: 'emeryville', date: ds, sessions,
      closureNotice: null,
      lastUpdated: new Date().toISOString(),
    };
  }

  return results;
}

// Vercel Edge Function proxy — used when direct fetch is blocked (e.g. GitHub Actions / Azure IPs).
// Note: Emeryville's Akamai CDN also blocks Cloudflare IPs, so this usually falls through.
const PROXY_URL = 'https://pool-finder-pearl.vercel.app/api/emeryville-proxy';

// Raw HTML file committed to git by a local Mac cron job (fetch-emeryville-html.mjs).
// Mac has a residential IP that Akamai doesn't block; CI reads this file and parses it.
const RAW_HTML_FILE = new URL('.emeryville-raw-page.html', import.meta.url).pathname;

async function fetchPage() {
  // Try direct fetch (works locally on a residential IP)
  try {
    const res = await fetch(URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    });
    if (res.ok) return await res.text();
    console.warn(`  Emeryville: direct fetch returned ${res.status}.`);
  } catch (err) {
    console.warn(`  Emeryville: direct fetch failed (${err.message}).`);
  }

  // Try Vercel proxy (blocked by Akamai too, but leaving in as a future option)
  const secret = process.env.PROXY_SECRET;
  if (secret) {
    try {
      const res = await fetch(PROXY_URL, { headers: { 'x-proxy-secret': secret } });
      if (res.ok) {
        console.log('  Emeryville: proxy fetch succeeded.');
        return await res.text();
      }
    } catch {}
  }

  // Read raw HTML committed to git by local Mac cron job (no API key required locally)
  if (existsSync(RAW_HTML_FILE)) {
    try {
      console.log('  Emeryville: using locally-committed raw HTML file.');
      return readFileSync(RAW_HTML_FILE, 'utf8');
    } catch (err) {
      console.warn(`  Emeryville: could not read raw HTML file (${err.message}).`);
    }
  }

  return null;
}

export async function scrapeEmeryville(daysAhead = 14) {
  // Load cache
  let cache = { pageHash: null, schedule: null };
  if (existsSync(CACHE_FILE)) {
    try { cache = JSON.parse(readFileSync(CACHE_FILE, 'utf8')); } catch {}
  }

  // Fetch live page (direct, then via proxy if blocked)
  const html = await fetchPage();
  let pageText, pageHash;
  if (!html) {
    console.warn('  Emeryville: all fetch attempts failed. Using cached schedule.');
    if (cache.schedule) {
      warnIfExpiringSoon(cache.schedule);
      return buildResults(cache.schedule, daysAhead);
    }
    return {};
  }
  pageText = extractScheduleText(html);
  pageHash = createHash('sha256').update(pageText).digest('hex');

  // Use cache if page hasn't changed
  if (cache.pageHash === pageHash && cache.schedule) {
    console.log('  Emeryville: page unchanged — using cached schedule.');
    warnIfExpiringSoon(cache.schedule);
    return buildResults(cache.schedule, daysAhead);
  }

  // Page changed — re-parse with Claude
  console.log('  Emeryville: page changed — parsing with Claude AI...');
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('  ANTHROPIC_API_KEY not set — skipping re-parse. Using cached schedule.');
    if (cache.schedule) return buildResults(cache.schedule, daysAhead);
    return {};
  }

  try {
    const schedule = await parseWithClaude(pageText);
    cache = { pageHash, schedule };
    writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
    const periods = schedule.periods.map(p => `${p.validFrom} – ${p.validUntil}`).join(', ');
    console.log(`  Emeryville: parsed → ${periods}`);
    return buildResults(schedule, daysAhead);
  } catch (err) {
    console.warn(`  Emeryville: Claude parsing failed (${err.message}). Using cached schedule.`);
    if (cache.schedule) return buildResults(cache.schedule, daysAhead);
    return {};
  }
}
