// El Cerrito Swim Center Splash Park
// 7007 Moeser Lane, El Cerrito, CA 94530
// Spray features only — not a pool. No lifeguard on duty.
// Source: https://www.elcerrito.gov/1579/Splash-Park
// Season end date (Sept 7) is approximate — verify each year.

import { dateStr } from './utils.js';

const SEASON_START = '2026-06-17'; // current schedule began 6/17
const SEASON_END   = '2026-09-07'; // Labor Day, approximate

export async function scrapeElCerritoSplash(daysAhead = 14) {
  const results = {};
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < daysAhead; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const ds = dateStr(d);

    if (ds < SEASON_START || ds > SEASON_END) continue;

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
