// Albany Aquatic Center — manual schedule entry
// Source: https://www.albanyaquaticcenter.com/pool-schedule
// The schedule is a PDF embedded in a Wix iframe and cannot be auto-scraped.
//
// HOW TO READ THE PDF (so future updates are entered correctly):
//
// OUTDOOR POOL — Lap Swim section:
//   Every row is a lap swim block, formatted as: "TIME (LANES)"
//   The lane count shrinks throughout the morning as swim lessons take over other lanes.
//   This is NOT a gap — the pool is open for lap the entire time, just with fewer lanes.
//   Mon/Wed/Fri: lessons start early, creating more granular blocks (6:00-7:15, 7:15-10:00, etc.)
//   Tue/Thu: no early lesson gap, so outdoor runs continuously (e.g. 6:00-10:00 all lanes).
//   Lane 1 is shared as Water Walk during AM blocks; PM (1:00-3:00p onward) = lap swim only.
//
// OUTDOOR POOL — Rec Swim/Diving Board section:
//   This runs SIMULTANEOUSLY with afternoon lap swim in different lane groups.
//   e.g. on weekdays, 1:00-3:00p has lap in lanes 2-6 AND rec in lanes 1, 7-10 at the same time.
//   Enter as separate sessions with different types and notes.
//
// INDOOR POOL:
//   Lap Swim (normally lanes 4-6, shared with lessons): listed as time ranges, sometimes with lanes.
//   Water Walk (WW) + Tot Swim (TS): share lanes 1-3 simultaneously with lap swim.
//     WW = open exercise for adults. TS = ages 4 and under with adult.
//     When shown as (ww/ts), both run at the same time. Stored here as type: 'tot'.
//   Family/Rec Swim: afternoon and evening, listed separately.
//   Swim Lessons: Mon–Thu 3:30–7:00p — takes over most lanes, ending afternoon lap swim.
//   Times marked * in PDF = evening sessions overlapping with family/rec swim.
//   Strikethrough times in PDF = cancelled (e.g. Saturday indoor 7:00-8:45a not available).
//
// UPDATING THIS FILE:
//   Albany updates the schedule every few weeks during the season.
//   When the PDF changes: share it in the chat → Claude rewrites this WEEKLY object.
//   After updating: run `node scrapers/run-scrapers.js` to push 14 days to Firestore.

import * as cheerio from 'cheerio';
import { dateStr } from './utils.js';

const URL = 'https://www.albanyaquaticcenter.com/pool-schedule';

// Schedule valid: June 21–July 9, 2026. Update when Albany posts next PDF.
const CLOSED_DATES = ['2026-06-19', '2026-07-03', '2026-07-04', '2026-08-09', '2026-09-07'];

const WEEKLY = {
  monday: [
    // Outdoor — Mon/Wed/Fri pattern: lessons create granular morning blocks
    { start: '6:00 AM',  end: '7:15 AM',  type: 'lap', pool: 'albany-outdoor', notes: 'Lanes 1-5' },
    { start: '7:15 AM',  end: '10:00 AM', type: 'lap', pool: 'albany-outdoor', notes: 'All lanes' },
    { start: '10:00 AM', end: '11:00 AM', type: 'lap', pool: 'albany-outdoor', notes: 'Lanes 1-2' },
    { start: '11:00 AM', end: '12:00 PM', type: 'lap', pool: 'albany-outdoor', notes: 'Lanes 6-10' },
    { start: '12:00 PM', end: '1:00 PM',  type: 'lap', pool: 'albany-outdoor', notes: '2 lanes' },
    { start: '1:00 PM',  end: '3:00 PM',  type: 'lap', pool: 'albany-outdoor', notes: 'Lanes 2-6' },
    { start: '1:00 PM',  end: '3:00 PM',  type: 'rec', pool: 'albany-outdoor', notes: 'Lanes 1, 7-10' },
    { start: '4:45 PM',  end: '8:00 PM',  type: 'lap', pool: 'albany-outdoor', notes: 'Lanes 1-2' },
    // Indoor
    { start: '6:00 AM',  end: '8:00 AM',  type: 'lap', pool: 'albany-indoor',  notes: null },
    { start: '8:00 AM',  end: '9:00 AM',  type: 'lap', pool: 'albany-indoor',  notes: 'Lanes 1, 6' },
    { start: '9:00 AM',  end: '12:20 PM', type: 'lap', pool: 'albany-indoor',  notes: null },
    { start: '9:00 AM',  end: '12:20 PM', type: 'tot', pool: 'albany-indoor',  notes: null },
    { start: '1:00 PM',  end: '3:00 PM',  type: 'rec', pool: 'albany-indoor',  notes: null },
    { start: '6:30 PM',  end: '8:00 PM',  type: 'lap', pool: 'albany-indoor',  notes: null },
    { start: '6:55 PM',  end: '8:00 PM',  type: 'rec', pool: 'albany-indoor',  notes: 'Limited capacity' },
  ],
  tuesday: [
    // Outdoor — Tue/Thu pattern: no early lesson gap, continuous 6:00-10:00 AM
    { start: '6:00 AM',  end: '10:00 AM', type: 'lap', pool: 'albany-outdoor', notes: 'All lanes' },
    { start: '10:00 AM', end: '11:00 AM', type: 'lap', pool: 'albany-outdoor', notes: 'Lanes 1-8' },
    { start: '11:00 AM', end: '12:00 PM', type: 'lap', pool: 'albany-outdoor', notes: 'Lanes 6-10' },
    { start: '12:00 PM', end: '1:00 PM',  type: 'lap', pool: 'albany-outdoor', notes: '2 lanes' },
    { start: '1:00 PM',  end: '3:00 PM',  type: 'lap', pool: 'albany-outdoor', notes: 'Lanes 2-6' },
    { start: '1:00 PM',  end: '3:00 PM',  type: 'rec', pool: 'albany-outdoor', notes: 'Lanes 1, 7-10' },
    { start: '4:45 PM',  end: '8:00 PM',  type: 'lap', pool: 'albany-outdoor', notes: 'Lanes 1-2' },
    // Indoor — Tue/Thu: shorter morning (no early lessons), same evening pattern as Mon
    { start: '7:00 AM',  end: '9:30 AM',  type: 'lap', pool: 'albany-indoor',  notes: null },
    { start: '7:00 AM',  end: '9:30 AM',  type: 'tot', pool: 'albany-indoor',  notes: null },
    { start: '1:00 PM',  end: '3:00 PM',  type: 'rec', pool: 'albany-indoor',  notes: null },
    { start: '6:30 PM',  end: '8:00 PM',  type: 'lap', pool: 'albany-indoor',  notes: null },
    { start: '6:55 PM',  end: '8:00 PM',  type: 'rec', pool: 'albany-indoor',  notes: 'Limited capacity' },
  ],
  wednesday: [
    // Outdoor — same as Monday (Mon/Wed/Fri pattern)
    { start: '6:00 AM',  end: '7:15 AM',  type: 'lap', pool: 'albany-outdoor', notes: 'Lanes 1-5' },
    { start: '7:15 AM',  end: '10:00 AM', type: 'lap', pool: 'albany-outdoor', notes: 'All lanes' },
    { start: '10:00 AM', end: '11:00 AM', type: 'lap', pool: 'albany-outdoor', notes: 'Lanes 1-5' },
    { start: '11:00 AM', end: '12:00 PM', type: 'lap', pool: 'albany-outdoor', notes: 'Lanes 6-10' },
    { start: '12:00 PM', end: '1:00 PM',  type: 'lap', pool: 'albany-outdoor', notes: '2 lanes' },
    { start: '1:00 PM',  end: '3:00 PM',  type: 'lap', pool: 'albany-outdoor', notes: 'Lanes 2-6' },
    { start: '1:00 PM',  end: '3:00 PM',  type: 'rec', pool: 'albany-outdoor', notes: 'Lanes 1, 7-10' },
    { start: '4:45 PM',  end: '8:00 PM',  type: 'lap', pool: 'albany-outdoor', notes: 'Lanes 1-2' },
    // Indoor — same as Monday
    { start: '6:00 AM',  end: '8:00 AM',  type: 'lap', pool: 'albany-indoor',  notes: null },
    { start: '8:00 AM',  end: '9:00 AM',  type: 'lap', pool: 'albany-indoor',  notes: 'Lanes 1, 6' },
    { start: '9:00 AM',  end: '12:20 PM', type: 'lap', pool: 'albany-indoor',  notes: null },
    { start: '9:00 AM',  end: '12:20 PM', type: 'tot', pool: 'albany-indoor',  notes: null },
    { start: '1:00 PM',  end: '3:00 PM',  type: 'rec', pool: 'albany-indoor',  notes: null },
    { start: '6:30 PM',  end: '8:00 PM',  type: 'lap', pool: 'albany-indoor',  notes: null },
    { start: '6:55 PM',  end: '8:00 PM',  type: 'rec', pool: 'albany-indoor',  notes: 'Limited capacity' },
  ],
  thursday: [
    // Outdoor — same as Tuesday (Tue/Thu pattern)
    { start: '6:00 AM',  end: '10:00 AM', type: 'lap', pool: 'albany-outdoor', notes: 'All lanes' },
    { start: '10:00 AM', end: '11:00 AM', type: 'lap', pool: 'albany-outdoor', notes: 'Lanes 1-8' },
    { start: '11:00 AM', end: '12:00 PM', type: 'lap', pool: 'albany-outdoor', notes: 'Lanes 6-10' },
    { start: '12:00 PM', end: '1:00 PM',  type: 'lap', pool: 'albany-outdoor', notes: '2 lanes' },
    { start: '1:00 PM',  end: '3:00 PM',  type: 'lap', pool: 'albany-outdoor', notes: 'Lanes 2-6' },
    { start: '1:00 PM',  end: '3:00 PM',  type: 'rec', pool: 'albany-outdoor', notes: 'Lanes 1, 7-10' },
    { start: '4:45 PM',  end: '8:00 PM',  type: 'lap', pool: 'albany-outdoor', notes: 'Lanes 1-2' },
    // Indoor — same as Tuesday
    { start: '7:00 AM',  end: '9:30 AM',  type: 'lap', pool: 'albany-indoor',  notes: null },
    { start: '7:00 AM',  end: '9:30 AM',  type: 'tot', pool: 'albany-indoor',  notes: null },
    { start: '1:00 PM',  end: '3:00 PM',  type: 'rec', pool: 'albany-indoor',  notes: null },
    { start: '6:30 PM',  end: '8:00 PM',  type: 'lap', pool: 'albany-indoor',  notes: null },
    { start: '6:55 PM',  end: '8:00 PM',  type: 'rec', pool: 'albany-indoor',  notes: 'Limited capacity' },
  ],
  friday: [
    // Outdoor — no afternoon rec swim on Fridays; morning ends at 12:30 PM (lessons till 4:45 PM)
    { start: '6:00 AM',  end: '7:15 AM',  type: 'lap', pool: 'albany-outdoor', notes: 'Lanes 1-5' },
    { start: '7:15 AM',  end: '10:00 AM', type: 'lap', pool: 'albany-outdoor', notes: 'All lanes' },
    { start: '10:00 AM', end: '11:00 AM', type: 'lap', pool: 'albany-outdoor', notes: 'Lanes 1-5' },
    { start: '11:00 AM', end: '12:30 PM', type: 'lap', pool: 'albany-outdoor', notes: 'Lanes 6-10' },
    { start: '4:45 PM',  end: '8:00 PM',  type: 'lap', pool: 'albany-outdoor', notes: 'Lanes 1-2' },
    // Indoor — no lessons Friday, so afternoon becomes lap+rec instead of lessons
    { start: '6:00 AM',  end: '8:00 AM',  type: 'lap', pool: 'albany-indoor',  notes: null },
    { start: '8:00 AM',  end: '9:00 AM',  type: 'lap', pool: 'albany-indoor',  notes: 'Lanes 1, 6' },
    { start: '9:00 AM',  end: '11:50 AM', type: 'lap', pool: 'albany-indoor',  notes: null },
    { start: '9:00 AM',  end: '11:50 AM', type: 'tot', pool: 'albany-indoor',  notes: null },
    { start: '4:45 PM',  end: '8:00 PM',  type: 'lap', pool: 'albany-indoor',  notes: null },
    { start: '4:45 PM',  end: '8:00 PM',  type: 'rec', pool: 'albany-indoor',  notes: null },
  ],
  saturday: [
    // Outdoor — AAA Youth 9:00-11:00a reduces available lanes early
    { start: '7:00 AM',  end: '9:00 AM',  type: 'lap', pool: 'albany-outdoor', notes: 'Lanes 1-5' },
    { start: '9:00 AM',  end: '11:00 AM', type: 'lap', pool: 'albany-outdoor', notes: 'Lanes 1-4' },
    { start: '11:00 AM', end: '1:00 PM',  type: 'lap', pool: 'albany-outdoor', notes: 'All lanes' },
    { start: '1:00 PM',  end: '4:00 PM',  type: 'lap', pool: 'albany-outdoor', notes: 'Lanes 2-6' },
    { start: '1:30 PM',  end: '4:00 PM',  type: 'rec', pool: 'albany-outdoor', notes: 'Lanes 1, 7-10' },
    // Indoor — Saturday indoor 7:00-8:45a is STRUCK THROUGH in PDF (not available)
    { start: '11:00 AM', end: '1:00 PM',  type: 'lap', pool: 'albany-indoor',  notes: null },
    { start: '11:00 AM', end: '1:00 PM',  type: 'tot', pool: 'albany-indoor',  notes: null },
    { start: '1:00 PM',  end: '4:00 PM',  type: 'rec', pool: 'albany-indoor',  notes: null },
  ],
  sunday: [
    // Outdoor — starts at 8 AM, no lessons, open all morning
    { start: '8:00 AM',  end: '11:00 AM', type: 'lap', pool: 'albany-outdoor', notes: 'Lanes 1-9' },
    { start: '11:00 AM', end: '1:00 PM',  type: 'lap', pool: 'albany-outdoor', notes: 'Lanes 1,2,7-9' },
    { start: '1:00 PM',  end: '4:00 PM',  type: 'lap', pool: 'albany-outdoor', notes: 'Lanes 2-6' },
    { start: '1:30 PM',  end: '4:00 PM',  type: 'rec', pool: 'albany-outdoor', notes: 'Lanes 1, 7-10' },
    // Indoor — no morning lap swim before 9:05; no evening sessions
    { start: '8:00 AM',  end: '11:55 AM', type: 'tot', pool: 'albany-indoor',  notes: null },
    { start: '9:05 AM',  end: '11:55 AM', type: 'lap', pool: 'albany-indoor',  notes: null },
    { start: '1:00 PM',  end: '4:00 PM',  type: 'rec', pool: 'albany-indoor',  notes: null },
  ],
};

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export async function albanySchedule(daysAhead = 14) {
  const results = {};
  const base = new Date();

  for (let i = 0; i < daysAhead; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    const ds = dateStr(d);
    if (CLOSED_DATES.includes(ds)) continue;

    const day = DAYS[d.getDay()];
    const daySessions = WEEKLY[day] || [];

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
        closureNotice: null,
      };
    });
  }

  // Check website for popup notices and per-date modification notes
  try {
    const res = await fetch(URL);
    const html = await res.text();
    const $ = cheerio.load(html);

    $('p, [class]').each((_, el) => {
      const text = $(el).text().trim();
      const m = text.match(/^(\d+)\/(\d+)\s*[:\-]\s*(.+)$/);
      if (!m) return;
      const month = parseInt(m[1]) - 1;
      const day = parseInt(m[2]);
      const year = new Date().getFullYear();
      const ds = dateStr(new Date(year, month, day));
      const notice = m[3].trim();
      if (/lane|clos|modif/i.test(notice)) {
        ['albany-indoor', 'albany-outdoor'].forEach(poolId => {
          if (results[`${poolId}_${ds}`]) {
            results[`${poolId}_${ds}`].closureNotice = notice;
          }
        });
      }
    });

    const dialog = $('dialog[open], dialog');
    if (dialog.length) {
      const dialogText = dialog.first().text().trim();
      if (/clos|modif|cancel|holiday|maintenance/i.test(dialogText)) {
        const lines = dialogText.split('\n').map(l => l.trim()).filter(Boolean);
        const startIdx = lines.findIndex(l => /upcoming/i.test(l));
        if (startIdx !== -1) {
          const closureLines = lines.slice(startIdx + 1)
            .filter(l => /\d+\/\d+/.test(l))
            .join(', ');
          if (closureLines) {
            const todayDs = dateStr(base);
            ['albany-indoor', 'albany-outdoor'].forEach(poolId => {
              if (results[`${poolId}_${todayDs}`]) {
                results[`${poolId}_${todayDs}`].closureNotice =
                  (results[`${poolId}_${todayDs}`].closureNotice
                    ? results[`${poolId}_${todayDs}`].closureNotice + ' | '
                    : '') + 'Upcoming: ' + closureLines;
              }
            });
          }
        }
      }
    }
  } catch (e) {
    // ignore — closureNotice stays null
  }

  return results;
}
