// Convert "6:00am" or "6:00 AM" -> "6:00 AM"
export function normalizeTime(raw) {
  raw = raw.trim().replace(/–/g, '-').replace(/ /g, ' ');
  const m = raw.match(/(\d{1,2}:\d{2})\s*(am|pm)/i);
  if (!m) return raw;
  const [, time, ampm] = m;
  return `${time} ${ampm.toUpperCase()}`;
}

// "6:00am-9:00am" or "6:00am – 9:00am" -> { start: "6:00 AM", end: "9:00 AM" }
export function parseTimeRange(raw) {
  raw = raw.trim().replace(/–|—/g, '-').replace(/ /g, ' ');
  const parts = raw.split(/[-–]\s*/);
  if (parts.length < 2) return null;
  const start = normalizeTime(parts[0]);
  const end = normalizeTime(parts.slice(1).join('-'));
  if (!start || !end) return null;
  return { start, end };
}

// "Monday-Thursday" or "Monday, Wednesday" -> ['monday','tuesday','wednesday','thursday']
const DAYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
export function expandDays(raw) {
  raw = raw.toLowerCase().replace(/ /g, ' ').trim();
  if (raw.includes('-')) {
    const [from, to] = raw.split('-').map(d => d.trim());
    const fi = DAYS.findIndex(d => d.startsWith(from.substring(0,3)));
    const ti = DAYS.findIndex(d => d.startsWith(to.substring(0,3)));
    if (fi === -1 || ti === -1) return [];
    return DAYS.slice(fi, ti + 1);
  }
  return raw.split(/,\s*/).map(d => {
    d = d.trim();
    return DAYS.find(day => day.startsWith(d.substring(0,3))) || null;
  }).filter(Boolean);
}

// Today's date as YYYY-MM-DD in local time
export function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// Date as YYYY-MM-DD
export function dateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// Day name from date
export function dayName(d) {
  return DAYS[d.getDay()];
}
