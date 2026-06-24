// Albany Aquatic Center — automatic schedule scraper
// Fetches the schedule PDF from Albany's Wix site, parses it with Claude AI,
// and caches the result so the AI call only runs when the PDF actually changes.
//
// Cache: scrapers/.albany-schedule-cache.json — committed to git.
// When Albany updates the PDF, the hash changes, Claude re-parses it,
// and the next git push captures the updated cache automatically.

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

async function getPdfUrl() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  let pdfUrl = null;
  page.on('response', resp => {
    const ct = resp.headers()['content-type'] || '';
    if (ct.includes('pdf')) pdfUrl = resp.url();
  });

  await page.goto(SCHEDULE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(8000);
  await browser.close();

  if (!pdfUrl) throw new Error('Could not find PDF on Albany schedule page');
  return pdfUrl;
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
- "validFrom" and "validUntil": extract from the header line (e.g. "June 21-July 9" → "2026-06-21" / "2026-07-09").
- "closedDates": parse from the "Closed:" line. Format as "YYYY-MM-DD". Use current year.

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

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 6000,
    messages: [{
      role: 'user',
      content: `${PARSE_PROMPT}\n\nPDF text to parse:\n\n${pdfText}`,
    }],
  });

  const raw = message.content[0].text.trim();
  // Strip any accidental markdown fences
  const clean = raw.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
  return JSON.parse(clean);
}

// --- Schedule builder ---

function buildSchedule(scheduleData, daysAhead) {
  const results = {};
  const base = new Date();
  const closedSet = new Set(scheduleData.closedDates || []);
  const weekly = scheduleData.weekly;

  for (let i = 0; i < daysAhead; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    const ds = dateStr(d);
    if (closedSet.has(ds)) continue;

    const day = DAYS[d.getDay()];
    const daySessions = weekly[day] || [];

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
  // Load cache
  let cache = null;
  if (existsSync(CACHE_FILE)) {
    try { cache = JSON.parse(readFileSync(CACHE_FILE, 'utf8')); } catch {}
  }

  // Get PDF and check hash
  let pdfText;
  let pdfHash;
  try {
    console.log('  Fetching Albany PDF via browser...');
    const pdfUrl = await getPdfUrl();
    const pdfBytes = await downloadPdf(pdfUrl);
    pdfText = await extractText(pdfBytes);
    pdfHash = createHash('sha256').update(pdfText).digest('hex');
  } catch (err) {
    console.warn(`  Warning: could not fetch Albany PDF (${err.message}). Using cached schedule.`);
    if (cache) return buildSchedule(cache, daysAhead);
    throw err;
  }

  // If hash unchanged, use cache
  if (cache && cache.pdfHash === pdfHash) {
    console.log('  Albany PDF unchanged — using cached schedule.');
    return buildSchedule(cache, daysAhead);
  }

  // Hash changed — re-parse with Claude
  console.log('  Albany PDF has changed! Parsing with Claude AI...');
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is required to parse updated Albany schedule');
  }

  const scheduleData = await parseWithClaude(pdfText);
  scheduleData.pdfHash = pdfHash;

  // Save updated cache
  writeFileSync(CACHE_FILE, JSON.stringify(scheduleData, null, 2));
  console.log('  Updated .albany-schedule-cache.json with new schedule.');

  return buildSchedule(scheduleData, daysAhead);
}
