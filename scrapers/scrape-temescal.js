// Temescal Pool (Oakland Parks & Rec)
// 371 45th St, Oakland, CA 94609
// Source: oaklandca.gov / Yelp (updated August 2026)
// Schedule: Mon/Wed/Fri 6:30–8:30 AM, 12–2 PM, 5:30–7:30 PM lap;
//           Tue/Thu 12–2 PM, 5:30–7:30 PM lap;
//           Sat/Sun 11 AM–2:30 PM recreational/family
// Season: roughly June–Sept; exact end date unconfirmed — verify annually

import { dateStr } from './utils.js';

const SEASON_START = '2026-06-01';
const SEASON_END   = '2026-09-07'; // Labor Day — verify each year

export async function scrapeTemescal(daysAhead = 14) {
  const results = {};
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < daysAhead; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const ds = dateStr(d);

    if (ds < SEASON_START || ds > SEASON_END) continue;

    const dow = d.getDay(); // 0=Sun, 6=Sat

    let sessions;
    if (dow === 0 || dow === 6) {
      // Sat & Sun: recreational/family swim
      sessions = [{ start: '11:00 AM', end: '2:30 PM', type: 'rec', notes: null }];
    } else if (dow === 1 || dow === 3 || dow === 5) {
      // Mon, Wed, Fri: three lap sessions
      sessions = [
        { start: '6:30 AM',  end: '8:30 AM',  type: 'lap', notes: null },
        { start: '12:00 PM', end: '2:00 PM',  type: 'lap', notes: null },
        { start: '5:30 PM',  end: '7:30 PM',  type: 'lap', notes: null },
      ];
    } else {
      // Tue, Thu: two lap sessions
      sessions = [
        { start: '12:00 PM', end: '2:00 PM', type: 'lap', notes: null },
        { start: '5:30 PM',  end: '7:30 PM', type: 'lap', notes: null },
      ];
    }

    results[`temescal_${ds}`] = {
      poolId: 'temescal',
      date: ds,
      sessions,
      closureNotice: null,
      lastUpdated: new Date().toISOString(),
    };
  }

  return results;
}
