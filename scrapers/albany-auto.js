// Albany Aquatic Center — automatic schedule scraper
// Handles multiple weekly PDFs (current week + next week) loaded via pdf-viewer-pro iframes.
// Each pdf-viewer-pro component is cached independently; only re-parses when its PDF changes.
//
// Cache: scrapers/.albany-schedule-cache.json
// New format: { byComp: { [compId]: { pdfHash, validFrom, validUntil, weekly, closedDates } } }

import { chromium } from 'playwright';
import { PDFParse } from 'pdf-parse';
import Anthropic from '@anthropic-ai/sdk';
import { createHash } from 'crypto';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { dateStr } from './utils.js';

const SCHEDULE_URL = 'https://www.albanyaquaticcenter.com/pool-schedule';
const CACHE_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '.albany-schedule-cache.json');
const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

// --- PDF fetch via Playwright ---

// Returns array of { compId, url } for all pdf-viewer-pro schedule PDFs on the page.
// comp IDs are stable Wix widget IDs; PDF content changes when Albany uploads a new schedule.
async function getPdfUrls() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const found = [];
  const seen = new Set();

  // Context-level listener catches responses from inside cross-origin iframes.
  // Filter to signed GCS URLs from pdf-viewer-pro only (avoids the static rules PDF).
  context.on('response', resp => {
    const url = resp.url();
    if (url.includes('pdf.pdf-viewer-pro.com') && url.includes('.pdf') && url.includes('Expires=')) {
      const compId = url.match(/\/(comp-[a-z0-9]+)\.pdf/i)?.[1];
      if (compId && !seen.has(compId)) {
        seen.add(compId);
        found.push({ compId, url });
      }
    }
  });

  await page.goto(SCHEDULE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(20000); // allow both iframes to load
  await browser.close();

  return found;
}

async function downloadPdf(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to download PDF: ${resp.status}`);
  return Buffer.from(await resp.arrayBuffer());
}

async function extractText(pdfBytes) {
  const tmpPath = `/tmp/albany-schedule-${Date.now()}.pdf`;
  writeFileSync(tmpPath, pdfBytes);
  const parser = new PDFParse({ url: `file://${tmpPath}` });
  const result = await parser.getText();
  return result.text;
}

// --- Claude AI parsing ---

const PARSE_PROMPT = `You are parsing an Albany Aquatic Center pool schedule from extracted PDF text.
Return ONLY valid JSON — no explanation, no markdown, just the JSON object.

Rules for interpreting the schedule:
- OUTDOOR POOL "Lap Swim" section: every time block listed = lap swim (pool: "albany-outdoor", type: "lap"). Lane numbers in parentheses go in "notes".
- OUTDOOR POOL "Rec Swim/Diving Board" section: simultaneous with afternoon lap swim in different lanes (type: "rec", pool: "albany-outdoor"). Notes = lane range.
- INDOOR POOL "Lap Swim" section: type "lap", pool "albany-indoor". Lane notes if specified (e.g. "Lanes 1, 6").
- INDOOR POOL "Water Walk / Tot Swim" section: type "tot", pool "albany-indoor". Covers both ww and ww/ts blocks.
- INDOOR POOL "Family/Rec Swim" section: type "rec", pool "albany-indoor".
- Strikethrough times in the PDF (indicated by context, often noted separately) = skip them.
- Asterisk (*) times = include as normal sessions.
- Time format: "6:00 AM", "10:00 AM", "1:00 PM", "4:45 PM" (always include AM/PM, no leading zero on hour).
- "validFrom" and "validUntil": extract from the header line (e.g. "Aug 10-16"). Use the CURRENT YEAR provided below unless a different year is explicitly written in the PDF.
- "closedDates": parse from the "Closed:" line. Format as "YYYY-MM-DD". Use the CURRENT YEAR unless a different year is explicitly written.

Return this exact JSON shape:
{
  "validFrom": "YYYY-MM-DD",
  "validUntil": "YYYY-MM-DD",
  "closedDates": ["YYYY-MM-DD"],
  "weekly": {
    "monday": [{ "start": "H:MM AM", "end": "H:MM PM", "type": "lap|rec|tot", "pool": "albany-outdoor|albany-indoor", "notes": "string or null" }],
    "tuesday": [...],
    "wednesday": [...],
    "thursday": [...],
    "friday": [...],
    "saturday": [...],
    "sunday": [...]
  }
}`;

async function parseWithClaude(pdfText) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const year = new Date().getFullYear();

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 6000,
    messages: [{
      role: 'user',
      content: `Current year: ${year}\n\n${PARSE_PROMPT}\n\nPDF text to parse:\n\n${pdfText}`,
    }],
  });

  const raw = message.content[0].text.trim();
  const clean = raw.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
  return JSON.parse(clean);
}

// --- Schedule builder ---

function buildSchedule(byComp, daysAhead) {
  const results = {};
  const base = new Date();
  base.setHours(0, 0, 0, 0);

  // Sort schedule periods by validFrom so we can find the right one for each date
  const periods = Object.values(byComp).sort((a, b) =>
    (a.validFrom || '').localeCompare(b.validFrom || '')
  );

  // Merge closed dates from all periods
  const allClosed = new Set(periods.flatMap(p => p.closedDates || []));

  for (let i = 0; i < daysAhead; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    const ds = dateStr(d);
    if (allClosed.has(ds)) continue;

    // Find the period that covers this date exactly
    let period = periods.find(p => ds >= (p.validFrom || '') && ds <= (p.validUntil || '9999'));
    // Fallback: use the most recent period (best guess when schedule isn't updated yet)
    if (!period) {
      period = [...periods].reverse().find(p => ds >= (p.validFrom || ''));
    }
    if (!period) continue;

    const day = DAYS[d.getDay()];
    const daySessions = period.weekly[day] || [];

    const byPool = {};
    daySessions.forEach(s => {
      if (!byPool[s.pool]) byPool[s.pool] = [];
      byPool[s.pool].push({ start: s.start, end: s.end, type: s.type, notes: s.notes || null });
    });

    Object.entries(byPool).forEach(([poolId, sessions]) => {
      results[`${poolId}_${ds}`] = {
        poolId,
        date: ds,
        sessions,
        lastUpdated: new Date().toISOString(),
        closureNotice: null,
      };
    });
  }

  return results;
}

// --- Main export ---

export async function albanySchedule(daysAhead = 14) {
  // Load cache. Migrates old single-PDF format (flat object with pdfHash/weekly at top level)
  // to new multi-PDF format ({ byComp: { [compId]: scheduleData } }).
  let cache = { byComp: {} };
  if (existsSync(CACHE_FILE)) {
    try {
      const raw = JSON.parse(readFileSync(CACHE_FILE, 'utf8'));
      if (raw.byComp) {
        cache = raw;
      } else if (raw.pdfHash && raw.weekly) {
        cache = { byComp: { 'comp-legacy': raw } };
        console.log('  Migrated Albany cache from single-PDF format.');
      }
    } catch {}
  }

  // Fetch all current schedule PDF URLs from the page
  let pdfEntries;
  try {
    console.log('  Fetching Albany schedule PDFs via browser...');
    pdfEntries = await getPdfUrls();
    if (!pdfEntries.length) throw new Error('No schedule PDFs found on Albany page');
    console.log(`  Found ${pdfEntries.length} PDF(s): ${pdfEntries.map(e => e.compId).join(', ')}`);
  } catch (err) {
    console.warn(`  Warning: could not fetch Albany PDFs (${err.message}). Using cached schedule.`);
    return buildSchedule(cache.byComp, daysAhead);
  }

  // Check hash and re-parse any PDFs that have changed
  let cacheChanged = false;
  for (const { compId, url } of pdfEntries) {
    let pdfText, pdfHash;
    try {
      const pdfBytes = await downloadPdf(url);
      pdfText = await extractText(pdfBytes);
      pdfHash = createHash('sha256').update(pdfText).digest('hex');
    } catch (err) {
      console.warn(`  Warning: could not download ${compId} (${err.message}). Using cached.`);
      continue;
    }

    const cached = cache.byComp[compId];
    if (cached && cached.pdfHash === pdfHash) {
      console.log(`  ${compId}: unchanged — using cached schedule.`);
      continue;
    }

    console.log(`  ${compId}: changed — parsing with Claude AI...`);
    if (!process.env.ANTHROPIC_API_KEY) {
      console.warn(`  ANTHROPIC_API_KEY not set — skipping re-parse of ${compId}.`);
      continue;
    }

    try {
      const scheduleData = await parseWithClaude(pdfText);
      scheduleData.pdfHash = pdfHash;
      cache.byComp[compId] = scheduleData;
      cacheChanged = true;
      console.log(`  ${compId}: parsed → ${scheduleData.validFrom} – ${scheduleData.validUntil}`);
    } catch (err) {
      console.warn(`  Claude AI parsing failed for ${compId}: ${err.message}. Using cached.`);
    }
  }

  if (cacheChanged) {
    writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
    console.log('  Updated .albany-schedule-cache.json.');
  }

  return buildSchedule(cache.byComp, daysAhead);
}
