// El Cerrito Swim Center — dynamic schedule scraper
// Handles multiple weekly PDFs (current week + next week) accumulating on the schedule page.
// Each PDF link is cached independently by URL; only re-parses when a PDF changes.
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

const MONTH_MAP = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
};

// Hard-coded holiday closures — Claude AI sometimes misses these when parsing the PDF.
const HARD_CLOSED = new Set([
  '2026-07-04', // Independence Day
]);

// Parse the end date from a DocumentCenter URL like ".../August-10-through-August-16-2026"
function parseEndDate(href) {
  const m = href.match(/through-(\w+)-(\d+)-(\d{4})/i);
  if (!m) return null;
  const monthIdx = MONTH_MAP[m[1].toLowerCase()];
  if (monthIdx === undefined) return null;
  return new Date(parseInt(m[3]), monthIdx, parseInt(m[2]));
}

// --- PDF fetch ---

// Returns all matching schedule PDF links from the El Cerrito schedule page,
// sorted by end date ascending (oldest first). We process all of them and
// let buildSchedule pick the right one for each date.
async function getScheduleLinks() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(SCHEDULE_PAGE, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(4000);

  const links = await page.$$eval('a', els =>
    els
      .filter(el => el.href.includes('DocumentCenter') || el.href.endsWith('.pdf'))
      .map(el => ({ href: el.href, text: el.innerText.trim() }))
  );

  await browser.close();

  const scheduleLinks = links.filter(l =>
    /swim.center.schedule/i.test(l.href) ||
    /swim.schedule/i.test(l.href) ||
    /schedule.*swim/i.test(l.text)
  );

  // Sort by end date ascending so buildSchedule periods are ordered
  return scheduleLinks.sort((a, b) => {
    const da = parseEndDate(a.href);
    const db = parseEndDate(b.href);
    return (da || 0) - (db || 0);
  });
}

async function fetchPdfBytes(url) {
  // DocumentCenter URLs trigger a file download — fetch directly via HTTP
  const resp = await fetch(url);
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

function buildSchedule(byLink, daysAhead) {
  const results = {};
  const base = new Date();
  base.setHours(0, 0, 0, 0);

  // Sort periods by validFrom
  const periods = Object.values(byLink).sort((a, b) =>
    (a.validFrom || '').localeCompare(b.validFrom || '')
  );

  // Merge closed dates across all periods + hard-coded closures
  const allClosed = new Set([...HARD_CLOSED, ...periods.flatMap(p => p.closedDates || [])]);

  for (let i = 0; i < daysAhead; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    const ds = dateStr(d);

    if (ds < SEASON_START || ds > SEASON_END) continue;

    if (allClosed.has(ds)) {
      results[`el-cerrito-pool_${ds}`] = {
        poolId: 'el-cerrito-pool',
        date: ds,
        sessions: [],
        closureNotice: 'Closed — see elcerrito.gov for details',
        lastUpdated: new Date().toISOString(),
      };
      continue;
    }

    // Find the period covering this date exactly
    let period = periods.find(p => ds >= (p.validFrom || '') && ds <= (p.validUntil || '9999'));
    // Fallback: most recent period (best-effort when schedule not yet updated)
    if (!period) {
      period = [...periods].reverse().find(p => ds >= (p.validFrom || ''));
    }
    if (!period) continue;

    const day = DAYS[d.getDay()];
    const sessions = (period.weekly[day] || []).map(s => ({
      start: s.start,
      end: s.end,
      type: s.type,
      notes: s.notes || null,
    }));

    results[`el-cerrito-pool_${ds}`] = {
      poolId: 'el-cerrito-pool',
      date: ds,
      sessions,
      closureNotice: null,
      lastUpdated: new Date().toISOString(),
    };
  }

  return results;
}

// --- Main export ---

export async function scrapeElCerritoPool(daysAhead = 14) {
  // Load cache. Migrates old single-PDF format to new multi-link format.
  // New format: { byLink: { [url]: { pdfHash, validFrom, validUntil, weekly, closedDates } } }
  let cache = { byLink: {} };
  if (existsSync(CACHE_FILE)) {
    try {
      const raw = JSON.parse(readFileSync(CACHE_FILE, 'utf8'));
      if (raw.byLink) {
        cache = raw;
      } else if (raw.pdfHash && raw.weekly) {
        cache = { byLink: { 'legacy': raw } };
        console.log('  Migrated El Cerrito cache from single-PDF format.');
      }
    } catch {}
  }

  // Get all schedule PDF links from the page
  let scheduleLinks;
  try {
    console.log('  Fetching El Cerrito schedule PDF links...');
    scheduleLinks = await getScheduleLinks();
    if (!scheduleLinks.length) throw new Error('No schedule PDF links found');
    console.log(`  Found ${scheduleLinks.length} schedule PDF(s).`);
  } catch (err) {
    console.warn(`  Warning: could not fetch El Cerrito links (${err.message}). Using cached schedule.`);
    return buildSchedule(cache.byLink, daysAhead);
  }

  // Process each PDF link: check hash, re-parse if changed
  let cacheChanged = false;
  for (const link of scheduleLinks) {
    const url = link.href;
    let pdfText, pdfHash;
    try {
      const pdfBytes = await fetchPdfBytes(url);
      pdfText = await extractText(pdfBytes);
      pdfHash = createHash('sha256').update(pdfText).digest('hex');
    } catch (err) {
      console.warn(`  Warning: could not download ${url} (${err.message}). Skipping.`);
      continue;
    }

    const cached = cache.byLink[url];
    if (cached && cached.pdfHash === pdfHash) {
      console.log(`  ${url.split('/').slice(-1)[0]}: unchanged.`);
      continue;
    }

    console.log(`  ${url.split('/').slice(-1)[0]}: changed — parsing with Claude AI...`);
    if (!process.env.ANTHROPIC_API_KEY) {
      console.warn('  ANTHROPIC_API_KEY not set — skipping re-parse.');
      continue;
    }

    try {
      const scheduleData = await parseWithClaude(pdfText);
      scheduleData.pdfHash = pdfHash;
      cache.byLink[url] = scheduleData;
      cacheChanged = true;
      console.log(`  Parsed → ${scheduleData.validFrom} – ${scheduleData.validUntil}`);
    } catch (err) {
      console.warn(`  Claude AI parsing failed: ${err.message}. Using cached.`);
    }
  }

  if (cacheChanged) {
    writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
    console.log('  Updated .el-cerrito-pool-schedule-cache.json.');
  }

  return buildSchedule(cache.byLink, daysAhead);
}
