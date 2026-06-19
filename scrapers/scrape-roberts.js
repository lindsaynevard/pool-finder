// Roberts Regional Recreation Area Pool (East Bay Regional Parks)
// Seasonal outdoor pool: late June through late September
// All sessions are recreational swim (one open session per day)
// Source: https://www.ebparks.org/recreation/swimming/roberts

import { dateStr } from './utils.js';

// 2026 season hours
const SEASON_START = '2026-06-20';
const SEASON_END_WEEKDAY = '2026-08-14'; // last day with weekday hours
const SEASON_END = '2026-09-27';

// Weekday holidays within the season that follow weekend hours
const HOLIDAY_WEEKENDS = new Set(['2026-09-07']); // Labor Day

export async function scrapeRoberts(daysAhead = 14) {
  const results = {};
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < daysAhead; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const ds = dateStr(d);

    if (ds < SEASON_START || ds > SEASON_END) continue;

    const dow = d.getDay();
    const isWeekend = dow === 0 || dow === 6;
    const isHoliday = HOLIDAY_WEEKENDS.has(ds);

    let sessions;
    if (isWeekend || isHoliday) {
      sessions = [{ start: '11:00 AM', end: '6:00 PM', type: 'rec' }];
    } else if (ds <= SEASON_END_WEEKDAY) {
      sessions = [{ start: '11:00 AM', end: '4:00 PM', type: 'rec' }];
    } else {
      continue; // weekday after Aug 14, pool closed
    }

    results[`roberts_${ds}`] = {
      poolId: 'roberts',
      date: ds,
      sessions,
      closureNotice: null,
      lastUpdated: new Date().toISOString(),
    };
  }

  return results;
}
