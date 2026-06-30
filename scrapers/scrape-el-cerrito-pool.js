// El Cerrito Swim Center — Fitness Swim (lap pool, ages 14+)
// 7007 Moeser Lane, El Cerrito, CA 94530
// Schedule rotates weekly. Times sourced from June 29–July 5, 2026 PDF.
// Source: https://www.elcerrito.gov/150/Swim-Center

import { dateStr, dayName } from './utils.js';

const SEASON_START = '2026-06-17';
const SEASON_END   = '2026-09-07'; // approximate — Labor Day

// Closure dates hardcoded from PDF: "7/4/26 Swim Center CLOSED for 4th of July"
const CLOSED_DATES = new Set(['2026-07-04']);

// Fitness Swim schedule — week of June 29–July 5, 2026
// Shared space = minimum 2 lap lanes available (others may be using the pool)
// rECswim = family swim in the activity pool, concurrent with shared Fitness Swim
// Source: https://www.elcerrito.gov/1507/Family-Lane
const WEEKLY = {
  monday: [
    { start: '6:00 AM',  end: '8:00 AM',   type: 'lap',    notes: 'Ages 14+' },
    { start: '11:00 AM', end: '11:55 AM',  type: 'lap',    notes: 'Ages 14+' },
    { start: '12:30 PM', end: '3:00 PM',   type: 'lap',    notes: 'Ages 14+ · Min. 2 lanes, shared pool' },
    { start: '12:30 PM', end: '3:00 PM',   type: 'family', notes: 'Activity pool · rECswim' },
  ],
  tuesday: [
    { start: '6:00 AM',  end: '8:00 AM',   type: 'lap',    notes: 'Ages 14+' },
    { start: '10:00 AM', end: '12:15 PM',  type: 'lap',    notes: 'Ages 14+' },
    { start: '12:30 PM', end: '3:00 PM',   type: 'lap',    notes: 'Ages 14+ · Min. 2 lanes, shared pool' },
    { start: '12:30 PM', end: '3:00 PM',   type: 'family', notes: 'Activity pool · rECswim' },
  ],
  wednesday: [
    { start: '6:00 AM',  end: '8:00 AM',   type: 'lap',    notes: 'Ages 14+' },
    { start: '11:00 AM', end: '11:55 AM',  type: 'lap',    notes: 'Ages 14+' },
    { start: '12:30 PM', end: '3:00 PM',   type: 'lap',    notes: 'Ages 14+ · Min. 2 lanes, shared pool' },
    { start: '12:30 PM', end: '3:00 PM',   type: 'family', notes: 'Activity pool · rECswim' },
  ],
  thursday: [
    { start: '6:00 AM',  end: '8:00 AM',   type: 'lap',    notes: 'Ages 14+' },
    { start: '10:00 AM', end: '12:15 PM',  type: 'lap',    notes: 'Ages 14+' },
    { start: '12:30 PM', end: '3:00 PM',   type: 'lap',    notes: 'Ages 14+ · Min. 2 lanes, shared pool' },
    { start: '12:30 PM', end: '3:00 PM',   type: 'family', notes: 'Activity pool · rECswim' },
  ],
  friday: [
    { start: '6:00 AM',  end: '8:00 AM',   type: 'lap',    notes: 'Ages 14+' },
    { start: '9:30 AM',  end: '10:25 AM',  type: 'lap',    notes: 'Ages 14+' },
    { start: '12:30 PM', end: '3:00 PM',   type: 'lap',    notes: 'Ages 14+ · Min. 2 lanes, shared pool' },
    { start: '12:30 PM', end: '3:00 PM',   type: 'family', notes: 'Activity pool · rECswim' },
  ],
  saturday: [
    { start: '7:00 AM',  end: '9:00 AM',   type: 'lap',    notes: 'Ages 14+' },
    { start: '1:00 PM',  end: '4:00 PM',   type: 'lap',    notes: 'Ages 14+ · Min. 2 lanes, shared pool' },
    { start: '1:00 PM',  end: '4:00 PM',   type: 'family', notes: 'Activity pool · rECswim' },
  ],
  sunday: [
    { start: '1:00 PM',  end: '4:00 PM',   type: 'lap',    notes: 'Ages 14+' },
    { start: '1:00 PM',  end: '4:00 PM',   type: 'family', notes: 'Activity pool · rECswim' },
  ],
};

export async function scrapeElCerritoPool(daysAhead = 14) {
  const results = {};
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < daysAhead; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const ds = dateStr(d);

    if (ds < SEASON_START || ds > SEASON_END) continue;

    if (CLOSED_DATES.has(ds)) {
      results[`el-cerrito-pool_${ds}`] = {
        poolId: 'el-cerrito-pool',
        date: ds,
        sessions: [],
        closureNotice: 'Closed — see elcerrito.gov for details',
        lastUpdated: new Date().toISOString(),
      };
      continue;
    }

    const sessions = WEEKLY[dayName(d)] || [];
    results[`el-cerrito-pool_${ds}`] = {
      poolId: 'el-cerrito-pool',
      date: ds,
      sessions,
      closureNotice: null,
      lastUpdated: new Date().toISOString(),
    };
  }

  return results;
}
