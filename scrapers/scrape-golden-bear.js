// Scraper for Golden Bear / Spieker pools (UC Berkeley RecWell)
// Schedule is date-specific, not day-of-week
import * as cheerio from 'cheerio';
import { normalizeTime, dateStr } from './utils.js';

const URL = 'https://recwell.berkeley.edu/schedules-reservations/lap-swim/';

const POOL_MAP = {
  'golden bear': 'golden-bear',
};

function parseDate(str) {
  // "6/15/2026" -> Date
  const [m, d, y] = str.trim().split('/').map(Number);
  return new Date(y, m - 1, d);
}

export async function scrapeGoldenBear() {
  const res = await fetch(URL);
  const html = await res.text();
  const $ = cheerio.load(html);

  const results = {};

  $('table tbody tr').each((_, row) => {
    const cells = $(row).find('td');
    if (cells.length < 3) return;

    const dateText = $(cells[0]).text().trim();
    if (!dateText.match(/\d+\/\d+\/\d+/)) return;

    const date = parseDate(dateText);
    const timesHtml = $(cells[2]).html() || '';
    const locsHtml = $(cells[3]).html() || '';

    const times = timesHtml.split(/<p[^>]*>/i)
      .map(t => cheerio.load(t).text().trim()).filter(Boolean);
    const locs = locsHtml.split(/<p[^>]*>/i)
      .map(t => cheerio.load(t).text().trim()).filter(Boolean);

    times.forEach((timeStr, i) => {
      if (timeStr.toLowerCase().includes('no ')) return;
      const loc = (locs[i] || '').toLowerCase();
      const poolId = Object.entries(POOL_MAP).find(([k]) => loc.includes(k))?.[1];
      if (!poolId) return;
      const parts = timeStr.replace(/–/g, '-').split(/\s*-\s*/);
      if (parts.length < 2) return;
      const start = normalizeTime(parts[0]);
      const end = normalizeTime(parts[1]);
      if (!start || !end) return;

      const key = `${poolId}_${dateStr(date)}`;
      if (!results[key]) {
        results[key] = { poolId, date: dateStr(date), sessions: [], lastUpdated: new Date().toISOString(), closureNotice: null };
      }
      results[key].sessions.push({ start, end, type: 'lap', notes: null });
    });
  });

  return results;
}
