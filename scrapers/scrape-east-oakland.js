// East Oakland Sports Center Pool (Larry E. Reid Sports Center)
// 9161 Edes Ave, Oakland, CA 94603
// Summer 2026 schedule: June 6 – July 31, 2026
// Public Recreational Swim: Mon–Sat 1:00 PM – 4:00 PM (no waterslide)
// Source: https://www.oaklandca.gov/Community/Parks-Facilities/Pools/Larry-E.-Reid-Sports-Center-Pool
//
// Oakland's website blocks plain fetch() with 403. We use Playwright (real browser)
// to load the page and extract session times. Falls back to hardcoded schedule if
// the page is unreachable or the format has changed.

import { chromium } from 'playwright';
import { dateStr } from './utils.js';

const SEASON_START = '2026-06-06';
const SEASON_END   = '2026-07-31';

const CLOSED_DATES = new Set([
  '2026-07-04', // Independence Day
]);

// Try to parse session times from Oakland page text.
// Returns [{ start, end }] or [] if nothing recognizable found.
function parseSessionsFromText(text) {
  const sessions = [];
  const timeRangeRe = /(\d{1,2}(?::\d{2})?\s*(?:AM|PM))\s*[–\-—to]+\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM))/gi;
  // Require "recreational" or "public recreational" near the time — avoids picking up lesson times.
  const contextRe = /(?:public\s+rec(?:reational)?|recreational\s+swim)/i;

  const normalize = t => {
    t = t.trim().toUpperCase();
    if (!t.includes(':')) {
      const [h, ampm] = t.split(/\s+/);
      t = `${h}:00 ${ampm}`;
    }
    return t.replace(/([0-9])(AM|PM)/, '$1 $2');
  };

  let m;
  while ((m = timeRangeRe.exec(text)) !== null) {
    const nearby = text.slice(Math.max(0, m.index - 150), m.index + 300);
    if (!contextRe.test(nearby)) continue;

    const start = normalize(m[1]);
    const end = normalize(m[2]);

    // Skip sessions under 60 minutes — those are lessons, not public rec swim.
    const toMin = s => { const [h, min] = s.replace(/(AM|PM)/, '').trim().split(':').map(Number); return (s.includes('PM') && h !== 12 ? h + 12 : s.includes('AM') && h === 12 ? 0 : h) * 60 + (min || 0); };
    if (toMin(end) - toMin(start) < 60) continue;

    sessions.push({ start, end });
  }

  // Deduplicate by start time
  const seen = new Set();
  return sessions.filter(s => {
    if (seen.has(s.start)) return false;
    seen.add(s.start);
    return true;
  });
}

async function fetchPageText() {
  const browser = await chromium.launch({ headless: true });
  try {
    const ctx = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    });
    const page = await ctx.newPage();
    const response = await page.goto(
      'https://www.oaklandca.gov/Community/Parks-Facilities/Pools/Larry-E.-Reid-Sports-Center-Pool',
      { waitUntil: 'domcontentloaded', timeout: 30000 }
    );
    if (!response || response.status() >= 400) {
      console.warn(`  Oakland page returned ${response?.status()} — using hardcoded fallback`);
      return null;
    }
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    return await page.evaluate(() => document.body.innerText);
  } catch (err) {
    console.warn(`  Playwright fetch failed: ${err.message} — using hardcoded fallback`);
    return null;
  } finally {
    await browser.close();
  }
}

function buildDayResults(daysAhead, sessions, closedDates) {
  const results = {};
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < daysAhead; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const ds = dateStr(d);

    if (ds < SEASON_START || ds > SEASON_END) continue;
    if (d.getDay() === 0) continue; // closed Sunday

    if (closedDates.has(ds)) {
      results[`east-oakland_${ds}`] = {
        poolId: 'east-oakland',
        date: ds,
        sessions: [],
        closureNotice: 'Closed — see oaklandca.gov for details',
        lastUpdated: new Date().toISOString(),
      };
      continue;
    }

    results[`east-oakland_${ds}`] = {
      poolId: 'east-oakland',
      date: ds,
      sessions: sessions.map(s => ({ ...s, type: 'rec', notes: null })),
      closureNotice: null,
      lastUpdated: new Date().toISOString(),
    };
  }
  return results;
}

export async function scrapeEastOakland(daysAhead = 14) {
  const HARDCODED_SESSIONS = [{ start: '1:00 PM', end: '4:00 PM' }];

  const pageText = await fetchPageText();
  if (pageText) {
    console.log('  Oakland page loaded via Playwright');
    // Log a snippet so we can verify the content in CI logs
    const snippet = pageText.replace(/\s+/g, ' ').slice(0, 500);
    console.log(`  Page text snippet: ${snippet}`);

    const parsed = parseSessionsFromText(pageText);
    if (parsed.length > 0) {
      console.log(`  Parsed ${parsed.length} session(s): ${parsed.map(s => `${s.start}–${s.end}`).join(', ')}`);
      return buildDayResults(daysAhead, parsed, CLOSED_DATES);
    } else {
      console.warn('  Could not parse session times from page — using hardcoded fallback');
    }
  }

  console.log(`  Using hardcoded schedule: ${HARDCODED_SESSIONS.map(s => `${s.start}–${s.end}`).join(', ')}`);
  return buildDayResults(daysAhead, HARDCODED_SESSIONS, CLOSED_DATES);
}
