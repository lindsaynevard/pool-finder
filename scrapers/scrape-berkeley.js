// Scraper for Berkeley city pools (West Campus and King) — identical HTML format
import * as cheerio from 'cheerio';
import { expandDays, parseTimeRange, dayName, dateStr } from './utils.js';

const POOLS = [
  {
    id: 'west-campus',
    url: 'https://berkeleyca.gov/community-recreation/parks-recreation/facilities/pools-and-aquatic-programs/west-campus-pool',
  },
  {
    id: 'king',
    url: 'https://berkeleyca.gov/community-recreation/parks-recreation/facilities/pools-and-aquatic-programs/king-pool',
  },
];

// Map caption text -> session type key
const TYPE_MAP = {
  'lap swim': 'lap',
  'family swim': 'family',
  'community swim': 'community',
  'independent exercise': 'lap', // dive tank — counts as lap
  'senior exercise': 'lap',
  'berkeley aquatic masters': 'lap',
};

function parseTable($, table) {
  const caption = $(table).find('caption').text().toLowerCase().trim();
  const type = Object.entries(TYPE_MAP).find(([k]) => caption.includes(k))?.[1] || 'other';
  if (type === 'other') return [];

  const sessions = [];
  $(table).find('tbody tr').each((_, row) => {
    const cells = $(row).find('td');
    if (cells.length < 2) return;
    const dayText = $(cells[0]).text().trim();
    const timeText = $(cells[1]).html() || '';
    const timeLines = timeText.split(/<br\s*\/?>/i).map(t =>
      cheerio.load(t).text().trim()
    ).filter(Boolean);

    const days = expandDays(dayText);
    timeLines.forEach(line => {
      const note = line.match(/\(([^)]+)\)/)?.[1] || null;
      const cleanLine = line.replace(/\s*\([^)]*\)/, '').trim();
      const range = parseTimeRange(cleanLine);
      if (!range) return;
      days.forEach(day => {
        sessions.push({ day, start: range.start, end: range.end, type, notes: note });
      });
    });
  });
  return sessions;
}

export async function scrapeBerkeley(daysAhead = 14) {
  const results = {};

  for (const pool of POOLS) {
    const res = await fetch(pool.url);
    const html = await res.text();
    const $ = cheerio.load(html);

    // Build weekly schedule
    const weekly = { sunday:[], monday:[], tuesday:[], wednesday:[], thursday:[], friday:[], saturday:[] };
    $('table').each((_, table) => {
      const sessions = parseTable($, table);
      sessions.forEach(s => weekly[s.day]?.push({ start: s.start, end: s.end, type: s.type, notes: s.notes }));
    });

    // Expand into specific dates for the next N days
    const base = new Date();
    for (let i = 0; i < daysAhead; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      const day = dayName(d);
      const key = `${pool.id}_${dateStr(d)}`;
      results[key] = {
        poolId: pool.id,
        date: dateStr(d),
        sessions: (weekly[day] || []),
        lastUpdated: new Date().toISOString(),
      };
    }
  }

  return results;
}
