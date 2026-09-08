// Scraper for Golden Bear Pool (GBRC) — UC Berkeley RecWell
// The schedule is date-specific (daily), not weekly.
// Page uses a LiveWhale JS widget — requires Playwright to render.
// Caches parsed schedule by page-text hash; only re-parses when content changes.
// Cache: scrapers/.golden-bear-schedule-cache.json

import { chromium } from 'playwright';
import Anthropic from '@anthropic-ai/sdk';
import { createHash } from 'crypto';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { normalizeTime, dateStr } from './utils.js';

const URL = 'https://recwell.berkeley.edu/schedules-reservations/lap-swim/';
const CACHE_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '.golden-bear-schedule-cache.json');

// Maps location strings from the schedule to our internal pool IDs
const POOL_MAP = {
  'gbrc': 'golden-bear',
  'golden bear': 'golden-bear',
  'gbrc pool': 'golden-bear',
  'golden bear pool': 'golden-bear',
};

const PARSE_PROMPT = `You are parsing the UC Berkeley RecWell lap swim schedule from a webpage.
Return ONLY valid JSON — no explanation, no markdown, just the JSON object.

The schedule shows specific dates with times and pool locations.
Pool names: "GBRC Pool" or "GBRC" = Golden Bear Recreation Center Pool.
"Spieker Pool" and "SCRA Pool" are other pools — include them too.

Rules:
- Time format: "7:00 AM", "11:00 AM", "12:00 PM", "1:15 PM" (always include AM/PM, no leading zero on hour).
  Input may use "a.m."/"p.m." — convert to "AM"/"PM".
  Whole-hour times: "7 a.m." → "7:00 AM", "9 a.m." → "9:00 AM", "12 p.m." → "12:00 PM".
- Date format: "YYYY-MM-DD". Parse "Tuesday, Sept. 8" and similar date strings using the current year.
- All sessions are type "lap".
- poolName: use the location string from the schedule exactly as it appears (e.g. "GBRC Pool", "Spieker Pool", "SCRA Pool").

Return this exact JSON shape:
{
  "entries": [
    {
      "date": "YYYY-MM-DD",
      "poolName": "GBRC Pool",
      "start": "H:MM AM",
      "end": "H:MM PM"
    }
  ]
}

Only include entries where you can clearly identify a date, time range, and pool name.`;

function resolvePoolId(poolName) {
  const lower = (poolName || '').toLowerCase().trim();
  for (const [key, id] of Object.entries(POOL_MAP)) {
    if (lower.includes(key)) return id;
  }
  return null;
}

async function fetchRenderedText() {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 },
      locale: 'en-US',
    });
    const page = await context.newPage();

    await page.goto(URL, { waitUntil: 'networkidle', timeout: 50000 });
    // The LiveWhale calendar widget renders asynchronously — wait for it to settle
    await page.waitForTimeout(12000);

    // Extract text from the main content area only (not nav/footer)
    const text = await page.evaluate(() => {
      const main = document.querySelector('main') || document.querySelector('#main') || document.body;
      return main.innerText;
    });
    return text;
  } finally {
    await browser.close();
  }
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

function buildResults(schedule) {
  const results = {};

  for (const entry of schedule.entries || []) {
    const poolId = resolvePoolId(entry.poolName);
    if (!poolId) continue;

    const start = normalizeTime(entry.start);
    const end = normalizeTime(entry.end);
    if (!start || !end) continue;

    const key = `${poolId}_${entry.date}`;
    if (!results[key]) {
      results[key] = {
        poolId,
        date: entry.date,
        sessions: [],
        closureNotice: null,
        lastUpdated: new Date().toISOString(),
      };
    }
    results[key].sessions.push({ start, end, type: 'lap', notes: null });
  }

  return results;
}

export async function scrapeGoldenBear() {
  // Load cache
  let cache = { pageHash: null, schedule: null };
  if (existsSync(CACHE_FILE)) {
    try { cache = JSON.parse(readFileSync(CACHE_FILE, 'utf8')); } catch {}
  }

  // Fetch rendered page text via Playwright
  let pageText, pageHash;
  try {
    pageText = await fetchRenderedText();
    pageHash = createHash('sha256').update(pageText).digest('hex');
  } catch (err) {
    console.warn(`  Golden Bear: Playwright fetch failed (${err.message}). Using cached schedule.`);
    if (cache.schedule) return buildResults(cache.schedule);
    return {};
  }

  // Use cache if page hasn't changed
  if (cache.pageHash === pageHash && cache.schedule) {
    console.log('  Golden Bear: page unchanged — using cached schedule.');
    return buildResults(cache.schedule);
  }

  // Page changed — re-parse with Claude
  console.log('  Golden Bear: page changed — parsing with Claude AI...');
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('  ANTHROPIC_API_KEY not set — skipping re-parse. Using cached schedule.');
    if (cache.schedule) return buildResults(cache.schedule);
    return {};
  }

  try {
    const schedule = await parseWithClaude(pageText);
    cache = { pageHash, schedule };
    writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
    const dates = [...new Set((schedule.entries || []).map(e => e.date))].sort();
    console.log(`  Golden Bear: parsed ${schedule.entries?.length || 0} entries across ${dates.length} dates (${dates[0]} – ${dates.at(-1)})`);
    return buildResults(schedule);
  } catch (err) {
    console.warn(`  Golden Bear: Claude parsing failed (${err.message}). Using cached schedule.`);
    if (cache.schedule) return buildResults(cache.schedule);
    return {};
  }
}
