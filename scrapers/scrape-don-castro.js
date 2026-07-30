// Don Castro Swim Lagoon (East Bay Regional Parks)
// Chlorinated outdoor lagoon on the Hayward/Castro Valley border.
// Season: weekends + holidays May 16–Sept 27; weekdays June 1–Aug 14
// Hours: 11:00 AM – 5:30 PM (swimming closes 5:30 PM, gates close 6 PM)
// Source: https://www.ebparks.org/recreation/swimming/don-castro

import { dateStr } from './utils.js';

const WEEKEND_SEASON_START = '2026-05-16';
const WEEKDAY_SEASON_START = '2026-06-01';
const WEEKDAY_SEASON_END   = '2026-08-14';
const SEASON_END           = '2026-09-27';

const HOLIDAY_WEEKDAYS = new Set([
  '2026-05-25', // Memorial Day
  '2026-07-04', // Independence Day
  '2026-09-07', // Labor Day
]);

export async function scrapeDonCastro(daysAhead = 14) {
  const results = {};
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < daysAhead; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const ds = dateStr(d);

    if (ds > SEASON_END) continue;

    const dow = d.getDay();
    const isWeekend = dow === 0 || dow === 6;
    const isHoliday = HOLIDAY_WEEKDAYS.has(ds);

    if (isWeekend || isHoliday) {
      if (ds < WEEKEND_SEASON_START) continue;
    } else {
      if (ds < WEEKDAY_SEASON_START || ds > WEEKDAY_SEASON_END) continue;
    }

    results[`don-castro_${ds}`] = {
      poolId: 'don-castro',
      date: ds,
      sessions: [{ start: '11:00 AM', end: '5:30 PM', type: 'rec', notes: null }],
      closureNotice: null,
      lastUpdated: new Date().toISOString(),
    };
  }

  return results;
}
