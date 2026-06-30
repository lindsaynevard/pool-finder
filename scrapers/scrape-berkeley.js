// Scraper for Berkeley city pools (West Campus and King) — identical HTML format
import * as cheerio from 'cheerio';
import { writeFileSync } from 'fs';
import { PDFParse } from 'pdf-parse';
import { expandDays, parseTimeRange, dayName, dateStr } from './utils.js';

const POOLS = [
  {
    id: 'west-campus',
    url: 'https://berkeleyca.gov/community-recreation/parks-recreation/facilities/pools-and-aquatic-programs/west-campus-pool',
  },
  {
    id: 'king',
    url: 'https://berkeleyca.gov/community-recreation/parks-recreation/facilities/pools-and-aquatic-programs/king-pool',
  },
];

// Map caption text -> session type key
const TYPE_MAP = {
  'lap swim': 'lap',
  'family swim': 'family',
  'community swim': 'community',
  'berkeley aquatic masters': 'masters',
};

function parseTable($, table) {
  const caption = $(table).find('caption').text().toLowerCase().trim();
  const type = Object.entries(TYPE_MAP).find(([k]) => caption.includes(k))?.[1] || 'other';
  if (type === 'other') return [];

  const sessions = [];
  $(table).find('tbody tr').each((_, row) => {
    const cells = $(row).find('td');
    if (cells.length < 2) return;
    const dayText = $(cells[0]).text().trim();
    const timeText = $(cells[1]).html() || '';
    const timeLines = timeText.split(/<br\s*\/?>/i).map(t =>
      cheerio.load(t).text().trim()
    ).filter(Boolean);

    const days = expandDays(dayText);
    timeLines.forEach(line => {
      const note = line.match(/\(([^)]+)\)/)?.[1] || null;
      const cleanLine = line.replace(/\s*\([^)]*\)/, '').trim();
      const range = parseTimeRange(cleanLine);
      if (!range) return;
      days.forEach(day => {
        sessions.push({ day, start: range.start, end: range.end, type, notes: note });
      });
    });
  });
  return sessions;
}

const MONTH_NAMES = {
  january:1, february:2, march:3, april:4, may:5, june:6,
  july:7, august:8, september:9, october:10, november:11, december:12,
};

// Fetch the pool's PDF schedule and extract closure dates from it.
// Handles both "Month Day" format ("June 19", "July 3") and "M/D" format ("7/3").
async function getClosedDates(poolUrl) {
  try {
    const res = await fetch(poolUrl);
    const html = await res.text();
    const $ = cheerio.load(html);

    let pdfUrl = null;
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') || '';
      if (href.includes('/sites/default/files/') && href.toLowerCase().endsWith('.pdf')) {
        pdfUrl = href.startsWith('http') ? href : `https://berkeleyca.gov${href}`;
        return false; // break
      }
    });

    if (!pdfUrl) return [];

    const pdfRes = await fetch(pdfUrl);
    if (!pdfRes.ok) return [];
    const pdfBytes = Buffer.from(await pdfRes.arrayBuffer());

    const tmpPath = `/tmp/berkeley-${Date.now()}.pdf`;
    writeFileSync(tmpPath, pdfBytes);
    const parser = new PDFParse({ url: `file://${tmpPath}` });
    const result = await parser.getText();
    const text = result.text;

    // Extract text windows around any closure mentions.
    // The PDF text has line breaks mid-sentence so we can't split on newlines.
    const year = new Date().getFullYear();
    const dates = new Set();
    const closedWindows = [];
    const closureRe = /(?:will\s+be\s+closed|closed\s+for)[^.]{0,300}/gi;
    let match;
    while ((match = closureRe.exec(text)) !== null) {
      closedWindows.push(match[0]);
    }
    const closedText = closedWindows.join(' ');

    // "Month Day" format (e.g. "June 19", "July 3")
    const monthDayRe = /(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})/gi;
    let m;
    while ((m = monthDayRe.exec(closedText)) !== null) {
      const month = MONTH_NAMES[m[1].toLowerCase()];
      dates.add(dateStr(new Date(year, month - 1, parseInt(m[2]))));
    }

    // "M/D" format (e.g. "7/3", "7/4") as fallback
    const mdRe = /(\d{1,2})\/(\d{1,2})/g;
    while ((m = mdRe.exec(closedText)) !== null) {
      dates.add(dateStr(new Date(year, parseInt(m[1]) - 1, parseInt(m[2]))));
    }

    return [...dates];
  } catch (err) {
    console.warn(`  Could not read closure dates from Berkeley PDF (${poolUrl}): ${err.message}`);
    return [];
  }
}

export async function scrapeBerkeley(daysAhead = 14) {
  const results = {};

  for (const pool of POOLS) {
    const res = await fetch(pool.url);
    const html = await res.text();
    const $ = cheerio.load(html);

    // Build weekly schedule from HTML table
    const weekly = { sunday:[], monday:[], tuesday:[], wednesday:[], thursday:[], friday:[], saturday:[] };
    $('table').each((_, table) => {
      const sessions = parseTable($, table);
      sessions.forEach(s => weekly[s.day]?.push({ start: s.start, end: s.end, type: s.type, notes: s.notes }));
    });

    // Get actual closure dates from the PDF linked on the page
    const closedDates = new Set(await getClosedDates(pool.url));
    if (closedDates.size > 0) {
      console.log(`  ${pool.id} closed dates from PDF: ${[...closedDates].join(', ')}`);
    }

    // Deduplicate sessions within each day (guards against overlapping table rows)
    for (const day of Object.keys(weekly)) {
      const seen = new Set();
      weekly[day] = weekly[day].filter(s => {
        const key = `${s.start}|${s.end}|${s.type}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    // Expand into specific dates for the next N days
    const base = new Date();
    for (let i = 0; i < daysAhead; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      const ds = dateStr(d);
      const isClosed = closedDates.has(ds);
      const key = `${pool.id}_${ds}`;
      results[key] = {
        poolId: pool.id,
        date: ds,
        sessions: isClosed ? [] : (weekly[dayName(d)] || []),
        lastUpdated: new Date().toISOString(),
        closureNotice: isClosed ? 'Closed — see berkeleyca.gov for details' : null,
      };
    }
  }

  return results;
}
