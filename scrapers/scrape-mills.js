// Trefethen Aquatic Center (formerly Mills College Pool)
// 5000 MacArthur Blvd, Oakland, CA 94613
// Schedule from Outlook published calendar (sportsandrec.oakland.northeastern.edu/hours/):
//   Mon:     6:00 AM – 1:00 PM  (Public Adult Lap Swim)
//   Tue–Fri: 8:00 AM – 1:00 PM  (Public Adult Lap Swim)
//   Sat–Sun: 1:00 PM – 5:00 PM  (Public Rec/Lap Swim, all ages)
// Closure dates fetched from the Trefethen page

import * as cheerio from 'cheerio';
import { dateStr } from './utils.js';

const CLOSURES_URL = 'https://sportsandrec.oakland.northeastern.edu/trefethen-aquatic-center/';

const MONTH_ABBR = {
  jan:1, feb:2, mar:3, apr:4, may:5, jun:6,
  jul:7, aug:8, sep:9, oct:10, nov:11, dec:12,
};

function expandDateRange(startMon, startDay, endMon, endDay, baseYear) {
  const dates = [];
  const endYear = endMon < startMon ? baseYear + 1 : baseYear;
  const start = new Date(baseYear, startMon - 1, startDay);
  const end   = new Date(endYear,   endMon   - 1, endDay);
  const d = new Date(start);
  while (d <= end) {
    dates.push(dateStr(new Date(d)));
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

async function getClosedDates() {
  const closed = new Set();
  try {
    const res = await fetch(CLOSURES_URL);
    if (!res.ok) return closed;
    const html = await res.text();
    const $ = cheerio.load(html);
    const text = $('body').text();

    const year = new Date().getFullYear();

    // Match ranges like "Aug 31–Sep 6", "Nov 26–28", "Dec 21–Jan 7", "May 9–10"
    const re = /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})\s*[–\-]\s*(?:(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+)?(\d{1,2})/gi;
    let m;
    while ((m = re.exec(text)) !== null) {
      const sm = MONTH_ABBR[m[1].toLowerCase().slice(0, 3)];
      const sd = parseInt(m[2]);
      const em = m[3] ? MONTH_ABBR[m[3].toLowerCase().slice(0, 3)] : sm;
      const ed = parseInt(m[4]);
      if (!sm || !em) continue;
      expandDateRange(sm, sd, em, ed, year).forEach(d => closed.add(d));
    }
  } catch (err) {
    console.warn(`  Trefethen: could not fetch closure dates: ${err.message}`);
  }
  return closed;
}

export async function scrapeMills(daysAhead = 14) {
  const results = {};
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const closedDates = await getClosedDates();
  if (closedDates.size > 0) {
    console.log(`  Trefethen closed dates from website: ${[...closedDates].sort().join(', ')}`);
  }

  for (let i = 0; i < daysAhead; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const ds = dateStr(d);
    const dow = d.getDay(); // 0=Sun, 1=Mon ... 6=Sat

    if (closedDates.has(ds)) {
      results[`mills_${ds}`] = {
        poolId: 'mills',
        date: ds,
        sessions: [],
        closureNotice: 'Closed — see sportsandrec.oakland.northeastern.edu for details',
        lastUpdated: new Date().toISOString(),
      };
      continue;
    }

    let sessions;
    if (dow === 1) {
      // Monday: earlier start
      sessions = [{ start: '6:00 AM', end: '1:00 PM', type: 'lap', notes: 'Adults 18+ · $8 public' }];
    } else if (dow >= 2 && dow <= 5) {
      // Tue–Fri
      sessions = [{ start: '8:00 AM', end: '1:00 PM', type: 'lap', notes: 'Adults 18+ · $8 public' }];
    } else {
      // Sat (6) & Sun (0): Public Rec/Lap Swim, all ages
      sessions = [{ start: '1:00 PM', end: '5:00 PM', type: 'rec', notes: 'All ages · $8 public' }];
    }

    results[`mills_${ds}`] = {
      poolId: 'mills',
      date: ds,
      sessions,
      closureNotice: null,
      lastUpdated: new Date().toISOString(),
    };
  }

  return results;
}
