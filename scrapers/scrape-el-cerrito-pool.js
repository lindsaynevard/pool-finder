// El Cerrito Swim Center — dynamic schedule scraper
// Weekly rotating PDF → Claude AI → cached weekly template
// Cache: scrapers/.el-cerrito-pool-schedule-cache.json
//
// Extracts: Fitness Swim (lap, ages 14+) and rECswim (family, activity pool).
// Splash Park is handled by scrape-el-cerrito-splash.js.

import { chromium } from 'playwright';
import { PDFParse } from 'pdf-parse';
import Anthropic from '@anthropic-ai/sdk';
import { createHash } from 'crypto';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { dateStr } from './utils.js';

const SCHEDULE_PAGE = 'https://www.elcerrito.gov/150/Swim-Center';
const CACHE_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '.el-cerrito-pool-schedule-cache.json');
const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const SEASON_START = '2026-06-17';
const SEASON_END   = '2026-09-07';

// Hard-coded holiday closures — Claude AI sometimes misses these when parsing the PDF.
// These override whatever closedDates Claude returns.
const HARD_CLOSED = new Set([
  '2026-07-04', // Independence Day
]);

// --- PDF fetch ---

async function getPdfBytes() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Load the schedule page to find the current PDF link
  await page.goto(SCHEDULE_PAGE, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(4000);

  const links = await page.$$eval('a', els =>
    els
      .filter(el => el.href.includes('DocumentCenter') || el.href.endsWith('.pdf'))
      .map(el => ({ href: el.href, text: el.innerText.trim() }))
  );

  await browser.close();

  const scheduleLink = links.find(l =>
    /swim.center.schedule/i.test(l.href) ||
    /swim.schedule/i.test(l.href) ||
    /schedule.*swim/i.test(l.text)
  ) || links[0];

  if (!scheduleLink) throw new Error('No schedule PDF link found on El Cerrito Swim Center page');

  // DocumentCenter URLs trigger a file download — fetch directly via HTTP instead of Playwright
  const resp = await fetch(scheduleLink.href);
  if (!resp.ok) throw new Error(`HTTP ${resp.status} fetching El Cerrito PDF`);
  return Buffer.from(await resp.arrayBuffer());
}

async function extractText(pdfBytes) {
  const tmpPath = `/tmp/el-cerrito-pool-${Date.now()}.pdf`;
  writeFileSync(tmpPath, pdfBytes);
  const parser = new PDFParse({ url: `file://${tmpPath}` });
  const result = await parser.getText();
  return result.text;
}

// --- Claude AI parsing ---

const PARSE_PROMPT = `You are parsing an El Cerrito Swim Center weekly schedule from extracted PDF text.
The PDF is a complex table where rows = program types and columns = days of the week.
PDF text extraction often scrambles the column order, so use context clues carefully.

Return ONLY valid JSON — no explanation, no markdown, just the JSON object.

Programs to extract (ignore all others — Water Aerobics, Masters, Gators, Swim Lessons, Splash Park):

1. FITNESS SWIM (lap pool, ages 14+)
   - Regular Fitness Swim blocks → type "lap", notes "Ages 14+"
   - "Fitness Shared Space" blocks (fewer lanes, other programs in pool) → type "lap", notes "Ages 14+ · Min. 2 lanes, shared pool"

2. rECswim (activity pool, family swim, no age restriction)
   - All rECswim blocks → type "family", notes "Activity pool · rECswim"

Rules:
- Extract the valid date range from the header (e.g. "June 29 – July 5, 2026")
- Extract any closure dates mentioned (e.g. "Closed July 4" → "2026-07-04")
- Time format: "6:00 AM", "10:00 AM", "12:30 PM" (always AM/PM, no leading zero on hour)
- If a day has no sessions for a program, omit it or use an empty array
- "validFrom" and "validUntil": use the schedule header dates, formatted as YYYY-MM-DD

Return this exact JSON shape:
{
  "validFrom": "YYYY-MM-DD",
  "validUntil": "YYYY-MM-DD",
  "closedDates": ["YYYY-MM-DD"],
  "weekly": {
    "monday":    [{ "start": "H:MM AM", "end": "H:MM PM", "type": "lap|family", "notes": "string" }],
    "tuesday":   [...],
    "wednesday": [...],
    "thursday":  [...],
    "friday":    [...],
    "saturday":  [...],
    "sunday":    [...]
  }
}`;

async function parseWithClaude(pdfText) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    messages: [{
      role: 'user',
      content: `${PARSE_PROMPT}\n\nPDF text to parse:\n\n${pdfText}`,
    }],
  });

  const raw = message.content[0].text.trim();
  const clean = raw.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
  return JSON.parse(clean);
}

// --- Schedule builder ---

function buildSchedule(scheduleData, daysAhead) {
  const results = {};
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  const closedSet = new Set([...(scheduleData.closedDates || []), ...HARD_CLOSED]);

  const validUntil = scheduleData.validUntil ? new Date(scheduleData.validUntil + 'T23:59:59') : null;
  const closureNotice = (validUntil && base > validUntil)
    ? 'El Cerrito schedule may be outdated — check elcerrito.gov for current times.'
    : null;

  for (let i = 0; i < daysAhead; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    const ds = dateStr(d);

    if (ds < SEASON_START || ds > SEASON_END) continue;

    if (closedSet.has(ds)) {
      results[`el-cerrito-pool_${ds}`] = {
        poolId: 'el-cerrito-pool',
        date: ds,
        sessions: [],
        closureNotice: 'Closed — see elcerrito.gov for details',
        lastUpdated: new Date().toISOString(),
      };
      continue;
    }

    const day = DAYS[d.getDay()];
    const sessions = (scheduleData.weekly[day] || []).map(s => ({
      start: s.start,
      end: s.end,
      type: s.type,
      notes: s.notes || null,
    }));

    results[`el-cerrito-pool_${ds}`] = {
      poolId: 'el-cerrito-pool',
      date: ds,
      sessions,
      closureNotice,
      lastUpdated: new Date().toISOString(),
    };
  }

  return results;
}

// --- Main export ---

export async function scrapeElCerritoPool(daysAhead = 14) {
  let cache = null;
  if (existsSync(CACHE_FILE)) {
    try { cache = JSON.parse(readFileSync(CACHE_FILE, 'utf8')); } catch {}
  }

  let pdfText, pdfHash;
  try {
    console.log('  Fetching El Cerrito schedule PDF via browser...');
    const pdfBytes = await getPdfBytes();
    pdfText = await extractText(pdfBytes);
    pdfHash = createHash('sha256').update(pdfText).digest('hex');
  } catch (err) {
    console.warn(`  Warning: could not fetch El Cerrito PDF (${err.message}). Using cached schedule.`);
    if (cache) return buildSchedule(cache, daysAhead);
    throw err;
  }

  if (cache && cache.pdfHash === pdfHash) {
    console.log('  El Cerrito PDF unchanged — using cached schedule.');
    return buildSchedule(cache, daysAhead);
  }

  console.log('  El Cerrito PDF has changed! Parsing with Claude AI...');
  if (!process.env.ANTHROPIC_API_KEY) {
    if (cache) {
      console.warn('  ANTHROPIC_API_KEY not set — using cached schedule (may be outdated)');
      return buildSchedule(cache, daysAhead);
    }
    throw new Error('ANTHROPIC_API_KEY is required to parse updated El Cerrito schedule (no cache available)');
  }

  let scheduleData;
  try {
    scheduleData = await parseWithClaude(pdfText);
  } catch (err) {
    console.warn(`  Claude AI parsing failed: ${err.message}. Using cached schedule.`);
    if (cache) return buildSchedule(cache, daysAhead);
    throw err;
  }
  scheduleData.pdfHash = pdfHash;

  writeFileSync(CACHE_FILE, JSON.stringify(scheduleData, null, 2));
  console.log('  Updated .el-cerrito-pool-schedule-cache.json with new schedule.');

  return buildSchedule(scheduleData, daysAhead);
}
