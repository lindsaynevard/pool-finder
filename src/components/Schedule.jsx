import { useState } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { POOLS, SAMPLE_SCHEDULE, SESSION_TYPES } from '../data/pools';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const FULL_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function getDateLabel(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  if (offset === 0) return 'Today';
  if (offset === 1) return 'Tomorrow';
  return `${FULL_DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

function groupByTime(sessions) {
  const map = {};
  sessions.forEach(s => {
    if (!map[s.time]) map[s.time] = [];
    map[s.time].push(s);
  });
  return Object.entries(map).sort(([a], [b]) => {
    const toMin = t => {
      const [time, ampm] = t.split(' ');
      let [h, m] = time.split(':').map(Number);
      if (ampm === 'PM' && h !== 12) h += 12;
      if (ampm === 'AM' && h === 12) h = 0;
      return h * 60 + m;
    };
    return toMin(a) - toMin(b);
  });
}

function getPoolName(poolId) {
  return POOLS.find(p => p.id === poolId)?.name || poolId;
}

export default function Schedule({ user }) {
  const [mode, setMode] = useState('lap');
  const [dayOffset, setDayOffset] = useState(0);
  const [tooltip, setTooltip] = useState(null);

  const tooltipInfo = {
    lap: 'Lap swim is designated lane swimming. Lanes may be shared with other swimmers.',
    family: 'Family swim is open to all ages. The pool is not divided into lanes.',
    community: 'Community swim is open recreational swimming, typically shared with lessons or other programs.',
    rec: 'Rec swim is open recreational swimming for all ages.',
    tot: 'Tot swim is a shallow-water session designed for young children and parents.',
    open: 'Open swim is general recreational swimming open to the public.',
  };

  const filtered = SAMPLE_SCHEDULE.filter(s =>
    mode === 'lap' ? s.type === 'lap' : s.type !== 'lap'
  );
  const grouped = groupByTime(filtered);
  const dateLabel = getDateLabel(dayOffset);

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
          <button
            className={`mode-btn ${mode === 'lap' ? 'active' : ''}`}
            onClick={() => setMode('lap')}
          >Lap</button>
          <button
            className={`mode-btn ${mode === 'family' ? 'active' : ''}`}
            onClick={() => setMode('family')}
          >Family</button>
        </div>
      </div>

      {/* Freshness banner */}
      <div className="freshness-banner green">
        ✓ All pools updated · as of today at 6:14 AM
      </div>

      {/* Day selector */}
      <div className="day-selector">
        <button className="day-arrow" onClick={() => setDayOffset(Math.max(0, dayOffset - 1))} disabled={dayOffset === 0}>‹</button>
        <span className="day-label">{dateLabel}</span>
        <button className="day-arrow" onClick={() => setDayOffset(Math.min(6, dayOffset + 1))}>›</button>
      </div>

      {/* Schedule */}
      <div className="schedule-list">
        {grouped.length === 0 && (
          <div className="empty-state">No {mode} swim sessions found for this day.</div>
        )}
        {grouped.map(([time, sessions]) => (
          <div key={time} className="time-block">
            <div className="time-header">{time}</div>
            {sessions.map((s, i) => {
              const pool = POOLS.find(p => p.id === s.poolId);
              return (
                <div key={i} className="session-row">
                  <div className="session-left">
                    <div className="pool-name">{pool?.name}</div>
                    <div className="session-meta">
                      <button
                        className="session-type-btn"
                        onClick={() => setTooltip(tooltip?.key === s.type && tooltip?.idx === `${time}-${i}` ? null : { key: s.type, idx: `${time}-${i}` })}
                      >
                        {SESSION_TYPES[s.type] || s.type}
                      </button>
                      {s.notes && <span className="session-note"> · {s.notes}</span>}
                    </div>
                    {tooltip?.idx === `${time}-${i}` && (
                      <div className="tooltip-card">
                        <strong>{SESSION_TYPES[s.type]}</strong>
                        <p>{tooltipInfo[s.type]}</p>
                        <button className="tooltip-close" onClick={() => setTooltip(null)}>✕</button>
                      </div>
                    )}
                  </div>
                  <div className="session-right">
                    <span className="end-time">until {s.endTime}</span>
                  </div>
                </div>
              );
            })}
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
