// Piedmont Community Pool
// 358 Highland Ave, Piedmont, CA 94611
// Summer 2026: June 8 – July 19, 2026
// Source: https://www.piedmont.ca.gov/services___departments/recreation/piedmont_community_pool
//
// Competition pool (12 lanes): lap swim → piedmont-lap
// Activity pool: open/family swim evenings + weekend mornings → piedmont-activity
// Schedule notes:
//   Mon–Thu: competition open 6am–1pm, 2pm–7pm (lesson break 1–2pm)
//   Fri:     competition open 6am–1pm, 2pm–8pm
//   Sat:     7am–8pm
//   Sun:     7am–6pm
// Activity pool open swim (family): Mon–Thu 4pm–7pm, Fri 4pm–8pm, Sat 7am–12:30pm, Sun 7am–6pm
// (lessons use activity pool Mon–Thu until 4pm, Sat–Sun until 12:30pm; activity pool opens June 20)

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
    const lapSessions = [];
    const activitySessions = [];

    if (dow >= 1 && dow <= 4) {
      // Monday–Thursday
      lapSessions.push({ start: '6:00 AM',  end: '1:00 PM', type: 'lap',  notes: null });
      lapSessions.push({ start: '2:00 PM',  end: '7:00 PM', type: 'lap',  notes: null });
      if (ds >= '2026-06-20') {
        activitySessions.push({ start: '4:00 PM', end: '7:00 PM', type: 'open', notes: null });
      }
    } else if (dow === 5) {
      // Friday
      lapSessions.push({ start: '6:00 AM',  end: '1:00 PM', type: 'lap',  notes: null });
      lapSessions.push({ start: '2:00 PM',  end: '8:00 PM', type: 'lap',  notes: null });
      if (ds >= '2026-06-20') {
        activitySessions.push({ start: '4:00 PM', end: '8:00 PM', type: 'open', notes: null });
      }
    } else if (dow === 6) {
      // Saturday
      lapSessions.push({ start: '7:00 AM',  end: '8:00 PM', type: 'lap',  notes: null });
      if (ds >= '2026-06-20') {
        activitySessions.push({ start: '7:00 AM', end: '12:30 PM', type: 'open', notes: null });
      }
    } else {
      // Sunday
      lapSessions.push({ start: '7:00 AM',  end: '6:00 PM', type: 'lap',  notes: null });
      if (ds >= '2026-06-20') {
        activitySessions.push({ start: '7:00 AM', end: '6:00 PM', type: 'open', notes: null });
      }
    }

    results[`piedmont-lap_${ds}`] = {
      poolId: 'piedmont-lap',
      date: ds,
      sessions: lapSessions,
      closureNotice: null,
      lastUpdated: new Date().toISOString(),
    };

    if (activitySessions.length > 0) {
      results[`piedmont-activity_${ds}`] = {
        poolId: 'piedmont-activity',
        date: ds,
        sessions: activitySessions,
        closureNotice: null,
        lastUpdated: new Date().toISOString(),
      };
    }
  }

  return results;
}
