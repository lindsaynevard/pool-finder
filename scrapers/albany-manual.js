// Albany Aquatic Center — manual schedule entry (schedule is a PDF in an iframe, not auto-scrapeable)
// Update this file each season when the schedule changes
// Indoor pool and Outdoor pool have separate session entries
import { dateStr, dayName } from './utils.js';

// Albany schedule (manually entered from PDF — last updated June 2026)
// Source: https://www.albanyaquaticcenter.com/pool-schedule
// Closed: 6/19, 7/3, 7/4, 8/9
const CLOSED_DATES = ['2026-06-19','2026-07-03','2026-07-04','2026-08-09'];

const WEEKLY = {
  monday: [
    { start: '6:00 AM', end: '7:45 AM', type: 'lap', pool: 'albany-indoor', notes: null },
    { start: '6:00 AM', end: '8:00 AM', type: 'lap', pool: 'albany-outdoor', notes: null },
    { start: '12:00 PM', end: '1:30 PM', type: 'lap', pool: 'albany-indoor', notes: null },
    { start: '3:30 PM', end: '8:00 PM', type: 'lap', pool: 'albany-indoor', notes: null },
    { start: '3:30 PM', end: '8:00 PM', type: 'lap', pool: 'albany-outdoor', notes: null },
    { start: '6:45 PM', end: '8:00 PM', type: 'family', pool: 'albany-indoor', notes: 'Limited capacity' },
  ],
  tuesday: [
    { start: '6:00 AM', end: '7:45 AM', type: 'lap', pool: 'albany-indoor', notes: null },
    { start: '6:00 AM', end: '8:00 AM', type: 'lap', pool: 'albany-outdoor', notes: null },
    { start: '12:00 PM', end: '1:30 PM', type: 'lap', pool: 'albany-indoor', notes: null },
    { start: '3:30 PM', end: '8:00 PM', type: 'lap', pool: 'albany-indoor', notes: null },
    { start: '3:30 PM', end: '8:00 PM', type: 'lap', pool: 'albany-outdoor', notes: null },
    { start: '6:45 PM', end: '8:00 PM', type: 'family', pool: 'albany-indoor', notes: 'Limited capacity' },
  ],
  wednesday: [
    { start: '6:00 AM', end: '7:45 AM', type: 'lap', pool: 'albany-indoor', notes: null },
    { start: '6:00 AM', end: '8:00 AM', type: 'lap', pool: 'albany-outdoor', notes: null },
    { start: '12:00 PM', end: '1:30 PM', type: 'lap', pool: 'albany-indoor', notes: null },
    { start: '3:30 PM', end: '8:00 PM', type: 'lap', pool: 'albany-indoor', notes: null },
    { start: '3:30 PM', end: '8:00 PM', type: 'lap', pool: 'albany-outdoor', notes: null },
    { start: '6:45 PM', end: '8:00 PM', type: 'family', pool: 'albany-indoor', notes: 'Limited capacity' },
  ],
  thursday: [
    { start: '6:00 AM', end: '7:45 AM', type: 'lap', pool: 'albany-indoor', notes: null },
    { start: '6:00 AM', end: '8:00 AM', type: 'lap', pool: 'albany-outdoor', notes: null },
    { start: '12:00 PM', end: '1:30 PM', type: 'lap', pool: 'albany-indoor', notes: null },
    { start: '3:30 PM', end: '8:00 PM', type: 'lap', pool: 'albany-indoor', notes: null },
    { start: '3:30 PM', end: '8:00 PM', type: 'lap', pool: 'albany-outdoor', notes: null },
    { start: '6:45 PM', end: '8:00 PM', type: 'family', pool: 'albany-indoor', notes: 'Limited capacity' },
  ],
  friday: [
    { start: '6:00 AM', end: '7:45 AM', type: 'lap', pool: 'albany-indoor', notes: null },
    { start: '6:00 AM', end: '8:00 AM', type: 'lap', pool: 'albany-outdoor', notes: null },
    { start: '12:00 PM', end: '1:30 PM', type: 'lap', pool: 'albany-indoor', notes: null },
    { start: '3:30 PM', end: '8:00 PM', type: 'lap', pool: 'albany-indoor', notes: null },
    { start: '3:30 PM', end: '8:00 PM', type: 'lap', pool: 'albany-outdoor', notes: null },
  ],
  saturday: [
    { start: '8:00 AM', end: '12:00 PM', type: 'lap', pool: 'albany-indoor', notes: null },
    { start: '8:00 AM', end: '12:00 PM', type: 'lap', pool: 'albany-outdoor', notes: null },
    { start: '12:00 PM', end: '3:30 PM', type: 'family', pool: 'albany-indoor', notes: null },
    { start: '12:00 PM', end: '3:30 PM', type: 'family', pool: 'albany-outdoor', notes: null },
    { start: '3:30 PM', end: '6:30 PM', type: 'lap', pool: 'albany-indoor', notes: null },
    { start: '3:30 PM', end: '6:30 PM', type: 'lap', pool: 'albany-outdoor', notes: null },
  ],
  sunday: [
    { start: '8:00 AM', end: '12:00 PM', type: 'lap', pool: 'albany-indoor', notes: null },
    { start: '8:00 AM', end: '12:00 PM', type: 'lap', pool: 'albany-outdoor', notes: null },
    { start: '12:00 PM', end: '3:30 PM', type: 'family', pool: 'albany-indoor', notes: null },
    { start: '12:00 PM', end: '3:30 PM', type: 'family', pool: 'albany-outdoor', notes: null },
    { start: '3:30 PM', end: '6:30 PM', type: 'lap', pool: 'albany-indoor', notes: null },
    { start: '3:30 PM', end: '6:30 PM', type: 'lap', pool: 'albany-outdoor', notes: null },
  ],
};

const DAYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];

export function albanySchedule(daysAhead = 14) {
  const results = {};
  const base = new Date();

  for (let i = 0; i < daysAhead; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    const ds = dateStr(d);
    if (CLOSED_DATES.includes(ds)) continue;

    const day = DAYS[d.getDay()];
    const daySessions = WEEKLY[day] || [];

    // Group by pool
    const byPool = {};
    daySessions.forEach(s => {
      if (!byPool[s.pool]) byPool[s.pool] = [];
      byPool[s.pool].push({ start: s.start, end: s.end, type: s.type, notes: s.notes });
    });

    Object.entries(byPool).forEach(([poolId, sessions]) => {
      results[`${poolId}_${ds}`] = {
        poolId,
        date: ds,
        sessions,
        lastUpdated: new Date().toISOString(),
      };
    });
  }

  return results;
}
