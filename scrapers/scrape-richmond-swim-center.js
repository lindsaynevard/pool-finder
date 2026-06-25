// Richmond Swim Center (RSC)
// 4300 Cutting Blvd (enter on 45th Street), Richmond, CA | 510-620-6654
// Summer 2026: June 22 – August 16, 2026
// Source: https://www.ci.richmond.ca.us/DocumentCenter/View/79633/SUMMER-26Pool-Schedule-and-Description-PDF
//
// Schedule (from PDF — Mon and Fri closed):
//   Tue:  7am–12pm (lap), 1:30–3:30pm (rec), 5–8pm (lap)
//   Wed:  6–11am (lap)
//   Thu:  7am–12pm (lap), 1:30–3:30pm (rec), 5–8pm (lap)
//   Sat:  9am–12pm (lap)
//   Sun:  10am–12:30pm (lap), 1:30–3:30pm (rec)
//
// Holiday closures within the summer window:
//   July 4 (Independence Day)

import { dateStr } from './utils.js';

const SEASON_START = '2026-06-22';
const SEASON_END   = '2026-08-16';

const CLOSED_DATES = new Set([
  '2026-07-04', // Independence Day
]);

const SESSIONS_BY_DOW = {
  0: [ // Sunday
    { start: '10:00 AM', end: '12:30 PM', type: 'lap', notes: null },
    { start: '1:30 PM',  end: '3:30 PM',  type: 'rec', notes: 'Public Rec Swim — all ages' },
  ],
  1: [], // Monday — closed
  2: [ // Tuesday
    { start: '7:00 AM',  end: '12:00 PM', type: 'lap', notes: null },
    { start: '1:30 PM',  end: '3:30 PM',  type: 'rec', notes: 'Public Rec Swim — all ages' },
    { start: '5:00 PM',  end: '8:00 PM',  type: 'lap', notes: null },
  ],
  3: [ // Wednesday
    { start: '6:00 AM',  end: '11:00 AM', type: 'lap', notes: null },
  ],
  4: [ // Thursday
    { start: '7:00 AM',  end: '12:00 PM', type: 'lap', notes: null },
    { start: '1:30 PM',  end: '3:30 PM',  type: 'rec', notes: 'Public Rec Swim — all ages' },
    { start: '5:00 PM',  end: '8:00 PM',  type: 'lap', notes: null },
  ],
  5: [], // Friday — closed
  6: [ // Saturday
    { start: '9:00 AM',  end: '12:00 PM', type: 'lap', notes: null },
  ],
};

export async function scrapeRichmondSwimCenter(daysAhead = 14) {
  const results = {};
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < daysAhead; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const ds = dateStr(d);

    if (ds < SEASON_START || ds > SEASON_END) continue;

    const dow = d.getDay();
    // Skip Mon (1) and Fri (5) — no entry needed since they're always closed
    if (dow === 1 || dow === 5) continue;

    if (CLOSED_DATES.has(ds)) {
      results[`richmond-swim-center_${ds}`] = {
        poolId: 'richmond-swim-center',
        date: ds,
        sessions: [],
        closureNotice: 'Closed — see ci.richmond.ca.us for details',
        lastUpdated: new Date().toISOString(),
      };
      continue;
    }

    const sessions = SESSIONS_BY_DOW[dow] ?? [];
    if (sessions.length === 0) continue;

    results[`richmond-swim-center_${ds}`] = {
      poolId: 'richmond-swim-center',
      date: ds,
      sessions,
      closureNotice: null,
      lastUpdated: new Date().toISOString(),
    };
  }

  return results;
}
