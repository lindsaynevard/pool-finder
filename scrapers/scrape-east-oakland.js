// East Oakland Sports Center Pool (Larry E. Reid Sports Center)
// 9161 Edes Ave, Oakland, CA 94603
// Summer 2026 schedule: June 6 – July 31, 2026
// Public Recreational Swim: Mon–Sat 1:00 PM – 4:00 PM (no waterslide)
// Source: https://www.oaklandca.gov/Community/Parks-Facilities/Pools/Larry-E.-Reid-Sports-Center-Pool

import { dateStr } from './utils.js';

const SEASON_START = '2026-06-06';
const SEASON_END = '2026-07-31';

const CLOSED_DATES = new Set([
  '2026-06-19', // Juneteenth
  '2026-07-04', // Independence Day
]);

export async function scrapeEastOakland(daysAhead = 14) {
  const results = {};
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < daysAhead; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const ds = dateStr(d);

    if (ds < SEASON_START || ds > SEASON_END) continue;

    const dow = d.getDay();
    if (dow === 0) continue; // closed Sunday
    if (CLOSED_DATES.has(ds)) continue;

    results[`east-oakland_${ds}`] = {
      poolId: 'east-oakland',
      date: ds,
      sessions: [{ start: '1:00 PM', end: '4:00 PM', type: 'rec' }],
      closureNotice: null,
      lastUpdated: new Date().toISOString(),
    };
  }

  return results;
}
