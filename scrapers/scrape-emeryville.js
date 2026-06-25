// Scraper for Emeryville ECCL lap swim
// Schedule uses date ranges rather than a simple weekly pattern
import * as cheerio from 'cheerio';
import { dateStr, dayName } from './utils.js';

const URL = 'https://www.emeryville.org/Recreation/Fitness/Aquatics/Swim-For-Fitness';

function parseTime(str) {
  str = str.trim();
  const m = str.match(/(\d{1,2}:\d{2})\s*(am|pm)/i);
  if (!m) return null;
  return `${m[1]} ${m[2].toUpperCase()}`;
}

function parseRange(str) {
  const parts = str.replace(/–|—/g, '-').split(/\s*-\s*/);
  if (parts.length < 2) return null;
  return { start: parseTime(parts[0]), end: parseTime(parts[1]) };
}

function parseDateStr(str) {
  // "June 22, 2026" or "June 22"
  str = str.trim();
  const months = { january:0,february:1,march:2,april:3,may:4,june:5,july:6,august:7,september:8,october:9,november:10,december:11 };
  const m = str.match(/(\w+)\s+(\d+),?\s*(\d{4})?/i);
  if (!m) return null;
  const month = months[m[1].toLowerCase()];
  if (month === undefined) return null;
  const day = parseInt(m[2]);
  const year = m[3] ? parseInt(m[3]) : new Date().getFullYear();
  return new Date(year, month, day);
}

function parseClosedDatesFromPage(html) {
  const $ = cheerio.load(html);
  const pageText = $('body').text();
  const year = new Date().getFullYear();
  const dates = new Set();

  // Extract text windows around closure mentions
  const closureRe = /(?:closed|closure)[^.]{0,300}/gi;
  let match;
  const windows = [];
  while ((match = closureRe.exec(pageText)) !== null) {
    windows.push(match[0]);
  }
  const closedText = windows.join(' ');

  // "M/D" format (e.g. "7/3", "7/4")
  const mdRe = /(\d{1,2})\/(\d{1,2})/g;
  let m;
  while ((m = mdRe.exec(closedText)) !== null) {
    dates.add(dateStr(new Date(year, parseInt(m[1]) - 1, parseInt(m[2]))));
  }

  // "Month Day" format
  const MONTHS = {january:1,february:2,march:3,april:4,may:5,june:6,july:7,august:8,september:9,october:10,november:11,december:12};
  const monthDayRe = /(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})/gi;
  while ((m = monthDayRe.exec(closedText)) !== null) {
    dates.add(dateStr(new Date(year, MONTHS[m[1].toLowerCase()] - 1, parseInt(m[2]))));
  }

  return [...dates];
}

export async function scrapeEmeryville(daysAhead = 14) {
  const res = await fetch(URL);
  const text = await res.text();

  // Current schedule periods — times sourced from the website
  const scheduleBlocks = [
    {
      from: new Date(2026, 5, 6),  // June 6
      to: new Date(2026, 5, 21),   // June 21
      weekdaySessions: [
        { start: '10:00 AM', end: '1:30 PM', type: 'lap' },
        { start: '7:30 PM', end: '9:00 PM', type: 'lap' },
      ],
      weekendSessions: [
        { start: '1:30 PM', end: '7:30 PM', type: 'lap' },
      ],
      closedDates: [],
    },
    {
      from: new Date(2026, 5, 22), // June 22
      to: new Date(2026, 7, 16),   // August 16
      weekdaySessions: [
        { start: '9:45 AM', end: '12:30 PM', type: 'lap', notes: '3 lanes only Mon-Thu' },
        { start: '7:30 PM', end: '9:00 PM', type: 'lap' },
      ],
      weekendSessions: [
        { start: '4:30 PM', end: '8:00 PM', type: 'lap' },
      ],
      closedDates: [],
    },
  ];

  // Populate closed dates from live website
  const liveClosed = parseClosedDatesFromPage(text);
  if (liveClosed.length > 0) {
    console.log(`  Emeryville closed dates from website: ${liveClosed.join(', ')}`);
    scheduleBlocks.forEach(b => { b.closedDates = liveClosed; });
  }

  const results = {};

  const base = new Date();
  for (let i = 0; i < daysAhead; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    const ds = dateStr(d);
    const day = d.getDay(); // 0=Sun, 6=Sat
    const isWeekend = day === 0 || day === 6;

    const block = scheduleBlocks.find(b => ds >= dateStr(b.from) && ds <= dateStr(b.to));
    if (!block) continue;
    if (block.closedDates?.includes(ds)) {
      results[`emeryville_${ds}`] = {
        poolId: 'emeryville',
        date: ds,
        sessions: [],
        lastUpdated: new Date().toISOString(),
        closureNotice: 'Closed — see emeryville.org for details',
      };
      continue;
    }

    const sessions = (isWeekend ? block.weekendSessions : block.weekdaySessions)
      .map(s => ({ ...s, notes: s.notes || null }));

    results[`emeryville_${ds}`] = {
      poolId: 'emeryville',
      date: ds,
      sessions,
      lastUpdated: new Date().toISOString(),
      closureNotice: null,
    };
  }

  // Parse "Modified Hours:" notices from the live page and attach to specific dates
  try {
    const $ = cheerio.load(text);
    $('strong').each((_, el) => {
      if (!$(el).text().includes('Modified Hours')) return;
      const list = $(el).parent().next('ul');
      list.find('li').each((_, li) => {
        const item = $(li).text().trim();
        const m = item.match(/^(\d+)\/(\d+)\s*[-–—]\s*(.+)/);
        if (!m) return;
        const month = parseInt(m[1]) - 1;
        const day = parseInt(m[2]);
        const year = new Date().getFullYear();
        const ds = dateStr(new Date(year, month, day));
        const notice = m[3].trim();
        if (results[`emeryville_${ds}`]) {
          results[`emeryville_${ds}`].closureNotice = notice;
        }
      });
    });
  } catch (e) {
    // ignore parse errors — closureNotice stays null
  }

  return results;
}
