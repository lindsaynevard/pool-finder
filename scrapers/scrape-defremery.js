// deFremery Pool (Oakland Parks & Rec)
// 1651 Adeline St, Oakland, CA 94607
// Summer 2026: Mon 6/8/26 – Fri 7/31/26
// Lap swim only: 12:30 PM – 1:30 PM, Monday–Friday
// Source: https://www.oaklandca.gov/Community/Recreation-Programs/Aquatics-Swimming/Lap-Swimmers-Information
// Holiday closures pulled live from the same page.

import * as cheerio from 'cheerio';
import { dateStr } from './utils.js';

const SCHEDULE_URL = 'https://www.oaklandca.gov/Community/Recreation-Programs/Aquatics-Swimming/Lap-Swimmers-Information';
const SEASON_START = '2026-06-08';
const SEASON_END   = '2026-07-31';

const MONTH_NAMES = {
  january:1, february:2, march:3, april:4, may:5, june:6,
  july:7, august:8, september:9, october:10, november:11, december:12,
};

async function getClosedDates() {
  try {
    const res = await fetch(SCHEDULE_URL);
    if (!res.ok) return new Set();
    const html = await res.text();
    const $ = cheerio.load(html);
    const text = $('body').text();

    // Find the "Holiday Closures" section
    const closureStart = text.indexOf('Holiday Closures');
    if (closureStart < 0) return new Set();
    const closureText = text.slice(closureStart, closureStart + 1500);

    const year = new Date().getFullYear();
    const dates = new Set();

    // "Month Day" format — e.g. "June 19th", "July 4th"
    const re = /(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:st|nd|rd|th)?/gi;
    let m;
    while ((m = re.exec(closureText)) !== null) {
      const month = MONTH_NAMES[m[1].toLowerCase()];
      dates.add(dateStr(new Date(year, month - 1, parseInt(m[2]))));
    }

    return dates;
  } catch (err) {
    console.warn(`  deFremery: could not fetch closure dates: ${err.message}`);
    return new Set();
  }
}

export async function scrapeDefremery(daysAhead = 14) {
  const results = {};
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const closedDates = await getClosedDates();
  if (closedDates.size > 0) {
    console.log(`  deFremery closed dates from Oakland website: ${[...closedDates].join(', ')}`);
  }

  for (let i = 0; i < daysAhead; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const ds = dateStr(d);

    if (ds < SEASON_START || ds > SEASON_END) continue;

    const dow = d.getDay();
    if (dow === 0 || dow === 6) continue; // closed weekends

    if (closedDates.has(ds)) {
      results[`defremery_${ds}`] = {
        poolId: 'defremery',
        date: ds,
        sessions: [],
        closureNotice: 'Closed — see oaklandca.gov for details',
        lastUpdated: new Date().toISOString(),
      };
      continue;
    }

    results[`defremery_${ds}`] = {
      poolId: 'defremery',
      date: ds,
      sessions: [{ start: '12:30 PM', end: '1:30 PM', type: 'lap', notes: null }],
      closureNotice: null,
      lastUpdated: new Date().toISOString(),
    };
  }

  return results;
}
