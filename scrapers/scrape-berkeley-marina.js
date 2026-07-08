// Berkeley Marina open water swim windows
// Uses NOAA tide predictions (station 9414816 — Berkeley, CA) to find
// contiguous windows where tide height >= 3.5 ft MLLW.
// No fixed hours — windows shift daily with the tides.

import { dateStr } from './utils.js';

const POOL_ID = 'berkeley-marina';
const NOAA_STATION = '9414816'; // Berkeley, CA
const TIDE_MIN = 3.5; // feet MLLW

function toAmPm(noaaTime) {
  // "2026-07-08 06:00" -> "6:00 AM"
  const [h, m] = noaaTime.slice(11).split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
}

function toYYYYMMDD(date) {
  return dateStr(date).replace(/-/g, '');
}

async function fetchPredictions(startDate, endDate) {
  const url =
    `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter` +
    `?begin_date=${startDate}&end_date=${endDate}` +
    `&station=${NOAA_STATION}` +
    `&product=predictions` +
    `&datum=MLLW` +
    `&time_zone=lst_ldt` +
    `&interval=h` +
    `&units=english` +
    `&application=pool_finder` +
    `&format=json`;

  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`NOAA API HTTP ${resp.status}`);
  const data = await resp.json();
  if (data.error) throw new Error(`NOAA API: ${data.error.message}`);
  return data.predictions; // [{t: "2026-07-08 00:00", v: "1.545"}, ...]
}

function swimWindowsForDay(preds) {
  // Find contiguous hourly blocks at or above TIDE_MIN
  const windows = [];
  let windowStart = null;

  for (let i = 0; i < preds.length; i++) {
    const height = parseFloat(preds[i].v);
    if (height >= TIDE_MIN) {
      if (!windowStart) windowStart = preds[i].t;
    } else {
      if (windowStart) {
        windows.push({ start: toAmPm(windowStart), end: toAmPm(preds[i].t) });
        windowStart = null;
      }
    }
  }
  if (windowStart) {
    windows.push({ start: toAmPm(windowStart), end: toAmPm(preds[preds.length - 1].t) });
  }

  return windows;
}

export async function scrapeBerkeleyMarina(daysAhead = 14) {
  const base = new Date();
  base.setHours(0, 0, 0, 0);

  const endDate = new Date(base);
  endDate.setDate(base.getDate() + daysAhead - 1);

  console.log(`  Fetching NOAA tide predictions for Berkeley (station ${NOAA_STATION})...`);
  const predictions = await fetchPredictions(toYYYYMMDD(base), toYYYYMMDD(endDate));
  console.log(`  ${predictions.length} hourly predictions — threshold ${TIDE_MIN} ft MLLW`);

  // Group predictions by date
  const byDate = {};
  for (const p of predictions) {
    const date = p.t.slice(0, 10);
    if (!byDate[date]) byDate[date] = [];
    byDate[date].push(p);
  }

  const results = {};
  for (let i = 0; i < daysAhead; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    const ds = dateStr(d);

    const dayWindows = swimWindowsForDay(byDate[ds] || []);
    const sessions = dayWindows.map(w => ({
      start: w.start,
      end: w.end,
      type: 'open-water',
      notes: 'Tide ≥ 3.5 ft · No lifeguard',
    }));

    results[`${POOL_ID}_${ds}`] = {
      poolId: POOL_ID,
      date: ds,
      sessions,
      lastUpdated: new Date().toISOString(),
    };
  }

  return results;
}
