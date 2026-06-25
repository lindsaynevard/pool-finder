// Richmond Plunge (Municipal Natatorium)
// 1 E. Richmond Ave, Richmond, CA 94801 | 510-620-6820
// Summer 2026: June 22 – August 16, 2026
// Source: https://www.ci.richmond.ca.us/2140/Richmond-Plunge
// PDF: https://www.ci.richmond.ca.us/DocumentCenter/View/79633/SUMMER-26Pool-Schedule-and-Description-PDF
//
// Session types from PDF:
//   LS = Lap Swim (ages 16+)
//   Rec Swim = Family Recreation Swim — all ages, shallow+deep
//
// Schedule:
//   Mon:  8am–1pm (lap), 4–7pm (lap)
//   Tue:  4–7pm (lap)
//   Wed:  8am–1pm (lap), 1:30–3:30pm (rec), 4–8pm (lap)
//   Thu:  4–7pm (lap)
//   Fri:  8am–1pm (lap), 2–3:30pm (rec), 4–7pm (lap)
//   Sat:  8am–12pm (lap), 1:30–3:30pm (rec)
//   Sun:  Closed
//
// Holiday closures within the summer window:
//   June 19 (Juneteenth), July 3 (Independence Day observed)

import { dateStr } from './utils.js';

const SEASON_START = '2026-06-22';
const SEASON_END   = '2026-08-16';

const CLOSED_DATES = new Set([
  '2026-06-19', // Juneteenth (before summer start, but included for safety)
  '2026-07-04', // Independence Day (per city PDF)
  '2026-08-15', // Plunge Event (per city PDF)
]);

const SESSIONS_BY_DOW = {
  1: [ // Monday
    { start: '8:00 AM',  end: '1:00 PM',  type: 'lap', notes: null },
    { start: '4:00 PM',  end: '7:00 PM',  type: 'lap', notes: null },
  ],
  2: [ // Tuesday
    { start: '4:00 PM',  end: '7:00 PM',  type: 'lap', notes: null },
  ],
  3: [ // Wednesday
    { start: '8:00 AM',  end: '1:00 PM',  type: 'lap', notes: null },
    { start: '1:30 PM',  end: '3:30 PM',  type: 'rec', notes: 'Public Rec Swim — all ages' },
    { start: '4:00 PM',  end: '8:00 PM',  type: 'lap', notes: null },
  ],
  4: [ // Thursday
    { start: '4:00 PM',  end: '7:00 PM',  type: 'lap', notes: null },
  ],
  5: [ // Friday
    { start: '8:00 AM',  end: '1:00 PM',  type: 'lap', notes: null },
    { start: '2:00 PM',  end: '3:30 PM',  type: 'rec', notes: 'Public Rec Swim — all ages' },
    { start: '4:00 PM',  end: '7:00 PM',  type: 'lap', notes: null },
  ],
  6: [ // Saturday
    { start: '8:00 AM',  end: '12:00 PM', type: 'lap', notes: null },
    { start: '1:30 PM',  end: '3:30 PM',  type: 'rec', notes: 'Public Rec Swim — all ages' },
  ],
  0: [], // Sunday — closed
};

export async function scrapeRichmond(daysAhead = 14) {
  const results = {};
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < daysAhead; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const ds = dateStr(d);

    if (ds < SEASON_START || ds > SEASON_END) continue;

    const dow = d.getDay();
    if (dow === 0) continue; // Sundays closed — no entry

    if (CLOSED_DATES.has(ds)) {
      results[`richmond_${ds}`] = {
        poolId: 'richmond',
        date: ds,
        sessions: [],
        closureNotice: 'Closed — see ci.richmond.ca.us for details',
        lastUpdated: new Date().toISOString(),
      };
      continue;
    }

    const sessions = SESSIONS_BY_DOW[dow] ?? [];
    results[`richmond_${ds}`] = {
      poolId: 'richmond',
      date: ds,
      sessions,
      closureNotice: null,
      lastUpdated: new Date().toISOString(),
    };
  }

  return results;
}
