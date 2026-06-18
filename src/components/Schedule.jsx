import { useState, useEffect } from 'react';
import { signOut } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { POOLS, SESSION_TYPES } from '../data/pools';

const FULL_DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function dateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function getDateLabel(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  if (offset === 0) return 'Today';
  if (offset === 1) return 'Tomorrow';
  return `${FULL_DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

function timeToMinutes(t) {
  const m = t.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!m) return 0;
  let h = parseInt(m[1]), min = parseInt(m[2]);
  const ampm = m[3].toUpperCase();
  if (ampm === 'PM' && h !== 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return h * 60 + min;
}

function groupByTime(sessions) {
  const map = {};
  sessions.forEach(s => {
    const key = s.start;
    if (!map[key]) map[key] = [];
    map[key].push(s);
  });
  return Object.entries(map).sort(([a], [b]) => timeToMinutes(a) - timeToMinutes(b));
}

function getPoolName(poolId) {
  return POOLS.find(p => p.id === poolId)?.name || poolId;
}

const TOOLTIP_TEXT = {
  lap: 'Designated lane swimming. Lanes may be shared with other swimmers.',
  family: 'Open recreational swimming for all ages. Pool is not divided into lanes.',
  community: 'Open recreational swimming, typically shared with lessons or other programs.',
  rec: 'Open recreational swimming for all ages.',
  tot: 'Shallow-water session designed for young children and parents.',
  open: 'General recreational swimming open to the public.',
};

export default function Schedule({ user }) {
  const [mode, setMode] = useState('lap');
  const [dayOffset, setDayOffset] = useState(0);
  const [tooltip, setTooltip] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    async function fetchSchedule() {
      setLoading(true);
      const d = new Date();
      d.setDate(d.getDate() + dayOffset);
      const ds = dateStr(d);

      try {
        const q = query(collection(db, 'schedules'), where('date', '==', ds));
        const snap = await getDocs(q);
        const allSessions = [];
        let latestUpdate = null;

        snap.forEach(doc => {
          const data = doc.data();
          if (data.sessions) {
            data.sessions.forEach(s => {
              allSessions.push({ ...s, poolId: data.poolId });
            });
          }
          if (data.lastUpdated && (!latestUpdate || data.lastUpdated > latestUpdate)) {
            latestUpdate = data.lastUpdated;
          }
        });

        setSessions(allSessions);
        setLastUpdated(latestUpdate);
      } catch (err) {
        console.error('Failed to fetch schedule:', err);
      }
      setLoading(false);
    }
    fetchSchedule();
  }, [dayOffset]);

  const filtered = sessions.filter(s =>
    mode === 'lap' ? s.type === 'lap' : ['family','rec','community','tot','open'].includes(s.type)
  );
  const grouped = groupByTime(filtered);

  const freshnessText = lastUpdated
    ? `✓ Last updated ${new Date(lastUpdated).toLocaleDateString('en-US', {month:'short', day:'numeric'})} at ${new Date(lastUpdated).toLocaleTimeString('en-US', {hour:'numeric', minute:'2-digit'})}`
    : '✓ Schedule loaded';

  return (
    <div className="screen">
      {/* Header */}
      <div className="header">
        <h1 className="app-title">PoolFinder</h1>
        <button className="avatar-btn" onClick={() => signOut(auth)} title="Sign out">
          {user.photoURL
            ? <img src={user.photoURL} alt="avatar" className="avatar" />
            : <div className="avatar-placeholder">{user.displayName?.[0]}</div>
          }
        </button>
      </div>

      {/* Mode toggle */}
      <div className="mode-toggle-wrap">
        <div className="mode-toggle">
          <button className={`mode-btn ${mode==='lap'?'active':''}`} onClick={() => setMode('lap')}>Lap</button>
          <button className={`mode-btn ${mode==='family'?'active':''}`} onClick={() => setMode('family')}>Family</button>
        </div>
      </div>

      {/* Freshness banner */}
      {!loading && <div className="freshness-banner green">{freshnessText}</div>}

      {/* Day selector */}
      <div className="day-selector">
        <button className="day-arrow" onClick={() => setDayOffset(Math.max(0, dayOffset-1))} disabled={dayOffset===0}>‹</button>
        <span className="day-label">{getDateLabel(dayOffset)}</span>
        <button className="day-arrow" onClick={() => setDayOffset(Math.min(13, dayOffset+1))}>›</button>
      </div>

      {/* Schedule */}
      <div className="schedule-list">
        {mode === 'family' && (
          <div className="coming-soon-banner">
            Family swim schedules coming soon — check back later!
          </div>
        )}

        {loading && <div className="empty-state">Loading schedule…</div>}

        {!loading && grouped.length === 0 && mode !== 'family' && (
          <div className="empty-state">No {mode} swim sessions found for this day.</div>
        )}

        {!loading && grouped.map(([time, slotSessions]) => (
          <div key={time} className="time-block">
            <div className="time-header">{time}</div>
            {slotSessions.map((s, i) => (
              <div key={i} className="session-row">
                <div className="session-left">
                  <div className="pool-name">{getPoolName(s.poolId)}</div>
                  <div className="session-meta">
                    <button
                      className="session-type-btn"
                      onClick={() => setTooltip(tooltip?.key===`${time}-${i}` ? null : {key:`${time}-${i}`, type:s.type})}
                    >
                      {SESSION_TYPES[s.type] || s.type}
                    </button>
                    {s.notes && <span className="session-note"> · {s.notes}</span>}
                  </div>
                  {tooltip?.key===`${time}-${i}` && (
                    <div className="tooltip-card">
                      <strong>{SESSION_TYPES[s.type]}</strong>
                      <p>{TOOLTIP_TEXT[s.type]}</p>
                      <button className="tooltip-close" onClick={() => setTooltip(null)}>✕</button>
                    </div>
                  )}
                </div>
                <div className="session-right">
                  <span className="end-time">until {s.end}</span>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div className="tab-bar">
        <button className="tab active">
          <span className="tab-icon">📅</span>
          <span>Schedule</span>
        </button>
        <button className="tab">
          <span className="tab-icon">🏊</span>
          <span>My Pools</span>
        </button>
        <button className="tab">
          <span className="tab-icon">⚙️</span>
          <span>Settings</span>
        </button>
      </div>
    </div>
  );
}
