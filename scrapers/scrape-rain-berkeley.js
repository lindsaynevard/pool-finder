// Berkeley Marina rain advisory scraper
// Fetches recent daily rainfall from Open-Meteo (no API key required) and
// computes an advisory level for the sailing basin based on EBRPD post-rain
// guidelines: do not swim for 3 days after significant rain.
//
// Advisory tiers (most recent qualifying rain event):
//   Heavy rain (≥ 0.10 in): days 1–3 → closed, days 4–5 → caution
//   Light rain (0.05–0.09 in): days 1–2 → caution

const LAT = 37.8657;
const LON = -122.3122;
const HEAVY_IN = 0.10;
const LIGHT_IN = 0.05;

function dateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function fetchDailyRainfall() {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${LAT}&longitude=${LON}` +
    `&daily=precipitation_sum` +
    `&timezone=America%2FLos_Angeles` +
    `&past_days=7&forecast_days=3` +
    `&precipitation_unit=inch`;

  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Open-Meteo API HTTP ${resp.status}`);
  const data = await resp.json();

  const { time, precipitation_sum } = data.daily;
  return time.map((t, i) => ({ date: t, inches: precipitation_sum[i] ?? 0 }));
}

function calculateAdvisory(daily) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const { date, inches } of daily) {
    if (inches < LIGHT_IN) continue;

    const rainDate = new Date(date + 'T12:00:00');
    const daysAgo = Math.round((today - rainDate) / 86400000);
    const isHeavy = inches >= HEAVY_IN;

    let level = 'none';
    if (isHeavy && daysAgo <= 3) level = 'closed';
    else if (isHeavy && daysAgo <= 5) level = 'caution';
    else if (!isHeavy && daysAgo <= 2) level = 'caution';

    if (level === 'none') break; // event is too old; no advisory

    const clearDays = isHeavy ? 5 : 2;
    const endsDate = new Date(date + 'T12:00:00');
    endsDate.setDate(endsDate.getDate() + clearDays);

    return {
      level,
      lastRainDate: date,
      rainfallInches: Math.round(inches * 100) / 100,
      severity: isHeavy ? 'heavy' : 'light',
      advisoryEnds: dateStr(endsDate),
    };
  }

  return { level: 'none', lastRainDate: null, rainfallInches: 0, severity: null, advisoryEnds: null };
}

export async function scrapeRainBerkeley() {
  console.log('  Fetching Berkeley rainfall from Open-Meteo (past 7 days + 3 day forecast)...');
  const all = await fetchDailyRainfall();

  const todayPacific = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });

  // Split: past (advisory) = yesterday and before; forecast = today and future.
  // Open-Meteo with past_days=7 gives yesterday-and-before; forecast_days=3 gives today+.
  // Using today in forecast lets the strip warn if heavy rain is expected today.
  const past = [...all].filter(d => d.date < todayPacific).reverse(); // most-recent-first
  const future = all.filter(d => d.date >= todayPacific);

  const rainy = past.filter(d => d.inches >= LIGHT_IN);
  console.log(`  ${rainy.length} day(s) with ≥ ${LIGHT_IN}" rain in past 7 days`);
  if (rainy.length) console.log(`  Most recent: ${rainy[0].date} — ${rainy[0].inches}"`);

  const advisory = calculateAdvisory(past);
  console.log(`  Advisory level: ${advisory.level}`);

  const forecastHeavyRainDates = future
    .filter(d => d.inches >= HEAVY_IN)
    .map(d => d.date);
  if (forecastHeavyRainDates.length) {
    console.log(`  Forecast heavy rain: ${forecastHeavyRainDates.join(', ')}`);
  }

  return {
    ...advisory,
    forecastHeavyRainDates,
    updatedAt: new Date().toISOString(),
  };
}
