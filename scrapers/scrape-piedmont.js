// Piedmont Community Pool
// 358 Highland Ave, Piedmont, CA 94611
// Year-round facility. Fall 2026 schedule effective Aug 24, 2026.
// Source: https://www.piedmont.ca.gov/services___departments/recreation/piedmont_community_pool
// News: https://piedmontexedra.com/2026/08/city-extends-evening-lap-swim-hours-at-community-pool
//
// Competition pool (12 lanes): lap swim → piedmont-lap
// Activity pool: open/family swim → piedmont-activity
//
// Fall schedule (Aug 24 onward):
//   Mon, Tue, Thu: 6am–1pm lap, 3pm–7pm lap; activity pool 3pm–7pm open swim
//   Wed:           6am–1pm lap, 2:30pm–6pm lap; activity pool 2:30pm–7pm open swim
//   Fri:           6am–1pm lap, 3pm–6pm lap; activity pool 3pm–7pm open swim
//   Sat:           7am–7pm lap; activity pool 7am–12:30pm open swim
//   Sun:           7am–5pm lap; activity pool 7am–5pm open swim
//
// Note: competition pool may be reduced from 5pm Mon and 6pm Tue–Fri due to water polo/swim team.
// Pass rates increase Sept 1. Activity pool lessons resume Sept 29 (Tue/Wed/Thu).

import { dateStr } from './utils.js';

const SEASON_START = '2026-06-08';
const SEASON_END   = '2026-12-31';

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

    const isFall = ds >= '2026-08-24';

    if (dow === 1 || dow === 2 || dow === 4) {
      // Monday, Tuesday, Thursday
      lapSessions.push({ start: '6:00 AM', end: '1:00 PM', type: 'lap', notes: null });
      lapSessions.push({ start: isFall ? '3:00 PM' : '2:00 PM', end: '7:00 PM', type: 'lap', notes: null });
      if (isFall) {
        activitySessions.push({ start: '3:00 PM', end: '7:00 PM', type: 'open', notes: null });
      } else if (ds >= '2026-06-20') {
        activitySessions.push({ start: '4:00 PM', end: '7:00 PM', type: 'open', notes: null });
      }
    } else if (dow === 3) {
      // Wednesday
      lapSessions.push({ start: '6:00 AM', end: '1:00 PM', type: 'lap', notes: null });
      lapSessions.push({ start: isFall ? '2:30 PM' : '2:00 PM', end: isFall ? '6:00 PM' : '7:00 PM', type: 'lap', notes: null });
      if (isFall) {
        activitySessions.push({ start: '2:30 PM', end: '7:00 PM', type: 'open', notes: null });
      } else if (ds >= '2026-06-20') {
        activitySessions.push({ start: '4:00 PM', end: '7:00 PM', type: 'open', notes: null });
      }
    } else if (dow === 5) {
      // Friday
      lapSessions.push({ start: '6:00 AM', end: '1:00 PM', type: 'lap', notes: null });
      lapSessions.push({ start: isFall ? '3:00 PM' : '2:00 PM', end: isFall ? '6:00 PM' : '8:00 PM', type: 'lap', notes: null });
      if (isFall) {
        activitySessions.push({ start: '3:00 PM', end: '7:00 PM', type: 'open', notes: null });
      } else if (ds >= '2026-06-20') {
        activitySessions.push({ start: '4:00 PM', end: '8:00 PM', type: 'open', notes: null });
      }
    } else if (dow === 6) {
      // Saturday
      lapSessions.push({ start: '7:00 AM', end: isFall ? '7:00 PM' : '8:00 PM', type: 'lap', notes: null });
      if (ds >= '2026-06-20') {
        activitySessions.push({ start: '7:00 AM', end: '12:30 PM', type: 'open', notes: null });
      }
    } else {
      // Sunday
      lapSessions.push({ start: '7:00 AM', end: isFall ? '5:00 PM' : '6:00 PM', type: 'lap', notes: null });
      if (ds >= '2026-06-20') {
        activitySessions.push({ start: '7:00 AM', end: isFall ? '5:00 PM' : '6:00 PM', type: 'open', notes: null });
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
