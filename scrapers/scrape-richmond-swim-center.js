// Richmond Swim Center (RSC)
// 4300 Cutting Blvd (enter on 45th Street), Richmond, CA | 510-620-6654
// Fall 2026: August 25, 2026 onward
// Source: https://ci.richmond.ca.us/DocumentCenter/View/76131/FallWinter-Pool-Schedule-and-Description-PDF
//
// Schedule (fall/spring — Mon and Fri closed; Tue/Thu rec swim is summer-only):
//   Tue:  7am–12pm (lap), 5–8pm (lap)
//   Wed:  6–11am (lap)
//   Thu:  7am–12pm (lap), 5–8pm (lap)
//   Sat:  9am–12pm (lap)
//   Sun:  10am–12:30pm (lap), 1:30–3:30pm (rec)
//
// Holiday closures: Sept 7 (Labor Day), Sept 9 (Admissions Day)

import { dateStr } from './utils.js';

const SEASON_START = '2026-08-25';
const SEASON_END   = '2026-12-31';

const CLOSED_DATES = new Set([
  '2026-09-07', // Labor Day
  '2026-09-09', // Admissions Day
]);

const SESSIONS_BY_DOW = {
  0: [ // Sunday
    { start: '10:00 AM', end: '12:30 PM', type: 'lap', notes: null },
    { start: '1:30 PM',  end: '3:30 PM',  type: 'rec', notes: 'Public Rec Swim — all ages' },
  ],
  1: [], // Monday — closed
  2: [ // Tuesday
    { start: '7:00 AM',  end: '12:00 PM', type: 'lap', notes: null },
    { start: '5:00 PM',  end: '8:00 PM',  type: 'lap', notes: null },
  ],
  3: [ // Wednesday
    { start: '6:00 AM',  end: '11:00 AM', type: 'lap', notes: null },
  ],
  4: [ // Thursday
    { start: '7:00 AM',  end: '12:00 PM', type: 'lap', notes: null },
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
