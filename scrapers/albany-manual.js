// Albany Aquatic Center — manual schedule entry (schedule is a PDF in an iframe, not auto-scrapeable)
// Update this file each season when the schedule changes
// Indoor pool and Outdoor pool have separate session entries
import * as cheerio from 'cheerio';
import { dateStr, dayName } from './utils.js';

const URL = 'https://www.albanyaquaticcenter.com/pool-schedule';

// Albany schedule (manually entered from PDF — last updated June 2026)
// Source: https://www.albanyaquaticcenter.com/pool-schedule
// Closed: 6/19, 7/3, 7/4, 8/9, 9/7
const CLOSED_DATES = ['2026-06-19','2026-07-03','2026-07-04','2026-08-09','2026-09-07'];

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
        closureNotice: null,
      };
    });
  }

  // Check the website for popup notices and per-date modification notes
  try {
    const res = await fetch(URL);
    const html = await res.text();
    const $ = cheerio.load(html);

    // Per-date modification notes in the header area (e.g. "6/26: 1 lane less than normal outdoor")
    // These appear as <p> text or generic text near the top of the page
    $('p, [class]').each((_, el) => {
      const text = $(el).text().trim();
      const m = text.match(/^(\d+)\/(\d+)\s*[:\-]\s*(.+)$/);
      if (!m) return;
      const month = parseInt(m[1]) - 1;
      const day = parseInt(m[2]);
      const year = new Date().getFullYear();
      const ds = dateStr(new Date(year, month, day));
      const notice = m[3].trim();
      if (notice.toLowerCase().includes('lane') || notice.toLowerCase().includes('clos') || notice.toLowerCase().includes('modif')) {
        ['albany-indoor', 'albany-outdoor'].forEach(poolId => {
          if (results[`${poolId}_${ds}`]) {
            results[`${poolId}_${ds}`].closureNotice = notice;
          }
        });
      }
    });

    // Check for an open <dialog> popup with closure/modification info
    const dialog = $('dialog[open], dialog');
    if (dialog.length) {
      const dialogText = dialog.first().text().trim();
      if (/clos|modif|cancel|holiday|maintenance/i.test(dialogText)) {
        // Extract the "Upcoming closures/modifications:" section if present
        const lines = dialogText.split('\n').map(l => l.trim()).filter(Boolean);
        const startIdx = lines.findIndex(l => /upcoming/i.test(l));
        if (startIdx !== -1) {
          const closureLines = lines.slice(startIdx + 1)
            .filter(l => /\d+\/\d+/.test(l))
            .join(', ');
          if (closureLines) {
            // Attach to today's documents as a general notice
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
