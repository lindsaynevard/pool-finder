// El Cerrito Swim Center Splash Park
// 7007 Moeser Lane, El Cerrito, CA 94530
// Spray features only — not a pool. No lifeguard on duty.
// Source: https://www.elcerrito.gov/1579/Splash-Park
// Season end date (Sept 7) is approximate — verify each year.

import * as cheerio from 'cheerio';
import { dateStr } from './utils.js';

const SEASON_START = '2026-06-17'; // current schedule began 6/17
const SEASON_END   = '2026-09-07'; // Labor Day, approximate
const PAGE_URL = 'https://www.elcerrito.gov/1579/Splash-Park';

// Fetch the El Cerrito Splash Park page and extract any closure dates mentioned.
// Handles formats like "7/4/26" and "Month Day".
async function getClosedDates() {
  try {
    const res = await fetch(PAGE_URL);
    if (!res.ok) return [];
    const html = await res.text();
    const $ = cheerio.load(html);
    const pageText = $('body').text();

    const year = new Date().getFullYear();
    const dates = new Set();

    // Look for sentences containing "CLOSED" or "closed"
    const closedSentences = pageText
      .split(/[.\n]/)
      .filter(s => /closed/i.test(s))
      .join(' ');

    // "M/D/YY" or "M/D" format (e.g. "7/4/26", "7/4")
    const mdRe = /(\d{1,2})\/(\d{1,2})(?:\/\d{2,4})?/g;
    let m;
    while ((m = mdRe.exec(closedSentences)) !== null) {
      dates.add(dateStr(new Date(year, parseInt(m[1]) - 1, parseInt(m[2]))));
    }

    // "Month Day" format
    const MONTHS = {january:1,february:2,march:3,april:4,may:5,june:6,july:7,august:8,september:9,october:10,november:11,december:12};
    const monthDayRe = /(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})/gi;
    while ((m = monthDayRe.exec(closedSentences)) !== null) {
      const month = MONTHS[m[1].toLowerCase()];
      dates.add(dateStr(new Date(year, month - 1, parseInt(m[2]))));
    }

    return [...dates];
  } catch (err) {
    console.warn(`  Could not read El Cerrito closure dates: ${err.message}`);
    return [];
  }
}

export async function scrapeElCerritoSplash(daysAhead = 14) {
  const results = {};
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const closedDates = new Set(await getClosedDates());
  if (closedDates.size > 0) {
    console.log(`  El Cerrito closed dates from website: ${[...closedDates].join(', ')}`);
  }

  for (let i = 0; i < daysAhead; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const ds = dateStr(d);

    if (ds < SEASON_START || ds > SEASON_END) continue;

    if (closedDates.has(ds)) {
      results[`el-cerrito-splash_${ds}`] = {
        poolId: 'el-cerrito-splash',
        date: ds,
        sessions: [],
        closureNotice: 'Closed — see elcerrito.gov for details',
        lastUpdated: new Date().toISOString(),
      };
      continue;
    }

    const dow = d.getDay();
    let sessions;

    if (dow === 6) {
      // Saturday: two sessions, all ages
      sessions = [
        { start: '9:00 AM',  end: '12:30 PM', type: 'rec', notes: 'All ages' },
        { start: '4:30 PM',  end: '7:00 PM',  type: 'rec', notes: 'All ages' },
      ];
    } else if (dow === 0) {
      // Sunday: one session, all ages
      sessions = [
        { start: '9:00 AM',  end: '12:30 PM', type: 'rec', notes: 'All ages' },
      ];
    } else {
      // Monday–Friday: two sessions, ages 7 & under
      sessions = [
        { start: '9:00 AM',  end: '12:00 PM', type: 'rec', notes: 'Ages 7 & under' },
        { start: '3:30 PM',  end: '7:00 PM',  type: 'rec', notes: 'Ages 7 & under' },
      ];
    }

    results[`el-cerrito-splash_${ds}`] = {
      poolId: 'el-cerrito-splash',
      date: ds,
      sessions,
      closureNotice: null,
      lastUpdated: new Date().toISOString(),
    };
  }

  return results;
}
