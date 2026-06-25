// Piedmont Community Pool
// 358 Highland Ave, Piedmont, CA 94611
// Summer 2026: June 8 – July 19, 2026
// Source: https://www.piedmont.ca.gov/services___departments/recreation/piedmont_community_pool
//
// Competition pool (12 lanes): lap swim during open hours
// Activity pool: open/family swim evenings + weekend mornings (starting June 20)
// Schedule notes:
//   Mon–Thu: competition open 6am–1pm, 2pm–7pm (lesson break 1–2pm)
//   Fri:     competition open 6am–1pm, 2pm–8pm
//   Sat:     7am–8pm
//   Sun:     7am–6pm
// Activity pool open swim (family): Mon–Thu 4pm–7pm, Fri 4pm–8pm, Sat 7am–12:30pm, Sun 7am–6pm
// (lessons use activity pool Mon–Thu until 4pm, Sat–Sun until 12:30pm)

import { dateStr } from './utils.js';

const SEASON_START = '2026-06-08';
const SEASON_END   = '2026-07-19';

export async function scrapePiedmont(daysAhead = 14) {
  const results = {};
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < daysAhead; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const ds = dateStr(d);

    if (ds < SEASON_START || ds > SEASON_END) continue;

    const dow = d.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    const sessions = [];

    if (dow >= 1 && dow <= 4) {
      // Monday–Thursday
      sessions.push({ start: '6:00 AM',  end: '1:00 PM', type: 'lap',  notes: 'Competition pool' });
      sessions.push({ start: '2:00 PM',  end: '7:00 PM', type: 'lap',  notes: 'Competition pool' });
      // Activity pool open swim starts June 20
      if (ds >= '2026-06-20') {
        sessions.push({ start: '4:00 PM', end: '7:00 PM', type: 'open', notes: 'Activity pool' });
      }
    } else if (dow === 5) {
      // Friday
      sessions.push({ start: '6:00 AM',  end: '1:00 PM', type: 'lap',  notes: 'Competition pool' });
      sessions.push({ start: '2:00 PM',  end: '8:00 PM', type: 'lap',  notes: 'Competition pool' });
      if (ds >= '2026-06-20') {
        sessions.push({ start: '4:00 PM', end: '8:00 PM', type: 'open', notes: 'Activity pool' });
      }
    } else if (dow === 6) {
      // Saturday
      sessions.push({ start: '7:00 AM',  end: '8:00 PM', type: 'lap',  notes: 'Competition pool' });
      if (ds >= '2026-06-20') {
        sessions.push({ start: '7:00 AM', end: '12:30 PM', type: 'open', notes: 'Activity pool' });
      }
    } else {
      // Sunday
      sessions.push({ start: '7:00 AM',  end: '6:00 PM', type: 'lap',  notes: 'Competition pool' });
      if (ds >= '2026-06-20') {
        sessions.push({ start: '7:00 AM', end: '6:00 PM', type: 'open', notes: 'Activity pool' });
      }
    }

    results[`piedmont_${ds}`] = {
      poolId: 'piedmont',
      date: ds,
      sessions,
      closureNotice: null,
      lastUpdated: new Date().toISOString(),
    };
  }

  return results;
}
