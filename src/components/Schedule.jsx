import { useState, useEffect } from 'react';
import { signOut, signInWithPopup } from 'firebase/auth';
import { collection, query, where, getDocs, doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, provider } from '../firebase';
import { POOLS, SESSION_TYPES } from '../data/pools';
import MyPools from './MyPools';
import SettingsTab from './SettingsTab';

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
  const [activeTab, setActiveTab] = useState('schedule');
  const [mode, setMode] = useState('lap');
  const [dayOffset, setDayOffset] = useState(0);
  const [tooltip, setTooltip] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [closureNotices, setClosureNotices] = useState({});
  const [preferences, setPreferences] = useState({ lap_favorites: [], family_favorites: [], lap_hidden: [], family_hidden: [] });

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
        const notices = {};

        snap.forEach(doc => {
          const data = doc.data();
          if (data.sessions) {
            data.sessions.forEach(s => {
              allSessions.push({ ...s, poolId: data.poolId });
            });
          }
          if (data.closureNotice) {
            notices[data.poolId] = data.closureNotice;
          }
          if (data.lastUpdated && (!latestUpdate || data.lastUpdated > latestUpdate)) {
            latestUpdate = data.lastUpdated;
          }
        });

        // Deduplicate in case the stored data has overlapping sessions
        const seen = new Set();
        const deduped = allSessions.filter(s => {
          const key = `${s.poolId}|${s.start}|${s.end}|${s.type}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        setSessions(deduped);
        setLastUpdated(latestUpdate);
        setClosureNotices(notices);
      } catch (err) {
        console.error('Failed to fetch schedule:', err);
      }
      setLoading(false);
    }
    fetchSchedule();
  }, [dayOffset]);

  useEffect(() => {
    if (!user) {
      setPreferences({ lap_favorites: [], family_favorites: [], lap_hidden: [], family_hidden: [] });
      return;
    }
    async function loadPrefs() {
      const snap = await getDoc(doc(db, 'user_preferences', user.uid));
      if (snap.exists()) {
        const data = snap.data();
        setPreferences({
          lap_favorites: data.lap_favorites || [],
          family_favorites: data.family_favorites || [],
          lap_hidden: data.lap_hidden || [],
          family_hidden: data.family_hidden || [],
        });
      }
    }
    loadPrefs();
  }, [user]);

  async function toggleHidden(poolId, hiddenMode) {
    const key = `${hiddenMode}_hidden`;
    const current = preferences[key];
    const updated = current.includes(poolId)
      ? current.filter(id => id !== poolId)
      : [...current, poolId];
    const newPrefs = { ...preferences, [key]: updated };
    setPreferences(newPrefs);
    if (user) {
      await setDoc(doc(db, 'user_preferences', user.uid), { [key]: updated }, { merge: true });
    }
  }

  async function toggleFavorite(poolId, favMode) {
    const key = `${favMode}_favorites`;
    const current = preferences[key];
    const updated = current.includes(poolId)
      ? current.filter(id => id !== poolId)
      : [...current, poolId];
    const newPrefs = { ...preferences, [key]: updated };
    setPreferences(newPrefs);
    if (user) {
      await setDoc(doc(db, 'user_preferences', user.uid), { [key]: updated }, { merge: true });
    }
  }

  const currentFavorites = mode === 'lap' ? preferences.lap_favorites : preferences.family_favorites;
  const favSet = new Set(currentFavorites);

  const hiddenSet = new Set(mode === 'lap' ? preferences.lap_hidden : preferences.family_hidden);
  const filtered = sessions.filter(s =>
    !hiddenSet.has(s.poolId) &&
    (mode === 'lap' ? s.type === 'lap' : ['family','rec','community','tot','open'].includes(s.type))
  );
  const sorted = [...filtered].sort((a, b) => {
    const aFav = favSet.has(a.poolId) ? 0 : 1;
    const bFav = favSet.has(b.poolId) ? 0 : 1;
    if (aFav !== bFav) return aFav - bFav;
    return getPoolName(a.poolId).localeCompare(getPoolName(b.poolId));
  });
  const grouped = groupByTime(sorted);

  const freshnessText = lastUpdated
    ? `✓ Last updated ${new Date(lastUpdated).toLocaleDateString('en-US', {month:'short', day:'numeric'})} at ${new Date(lastUpdated).toLocaleTimeString('en-US', {hour:'numeric', minute:'2-digit'})}`
    : '✓ Schedule loaded';

  const TAB_TITLES = { schedule: 'PoolFinder', 'my-pools': 'My Pools', settings: 'Settings' };

  return (
    <div className="screen">
      {/* Header */}
      <div className="header">
        <h1 className="app-title">{TAB_TITLES[activeTab]}</h1>
        {activeTab !== 'settings' && (
          user ? (
            <button className="avatar-btn" onClick={() => signOut(auth)} title="Sign out">
              {user.photoURL
                ? <img src={user.photoURL} alt="avatar" className="avatar" />
                : <div className="avatar-placeholder">{user.displayName?.[0]}</div>
              }
            </button>
          ) : (
            <button className="sign-in-btn" onClick={() => signInWithPopup(auth, provider)}>
              Sign in
            </button>
          )
        )}
      </div>

      {/* Schedule tab content */}
      {activeTab === 'schedule' && (
        <>
          {/* Mode toggle */}
          <div className="mode-toggle-wrap">
            <div className="mode-toggle">
              <button className={`mode-btn ${mode==='lap'?'active':''}`} onClick={() => setMode('lap')}>Lap</button>
              <button className={`mode-btn ${mode==='family'?'active':''}`} onClick={() => setMode('family')}>Family</button>
            </div>
          </div>

          {/* Freshness banner */}
          {!loading && <div className="freshness-banner green">{freshnessText}</div>}

          {/* Closure / modification notices — filtered to pools relevant to current mode */}
          {!loading && (() => {
            const modeNotices = Object.entries(closureNotices).filter(([poolId]) => {
              const pool = POOLS.find(p => p.id === poolId);
              return !pool?.swimTypes || pool.swimTypes.includes(mode);
            });
            return modeNotices.length > 0 && (
              <div className="closure-notices">
                {modeNotices.map(([poolId, notice]) => {
                  const pool = POOLS.find(p => p.id === poolId);
                  return (
                    <div key={poolId} className="closure-notice">
                      <span className="closure-icon">⚠️</span>
                      <span>
                        <strong>{getPoolName(poolId)}</strong> — {notice}
                        {pool?.websiteUrl && (
                          <a href={pool.websiteUrl} target="_blank" rel="noopener noreferrer" className="closure-notice-link"> View schedule ↗</a>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* Day selector */}
          <div className="day-selector">
            <button className="day-arrow" onClick={() => setDayOffset(Math.max(0, dayOffset-1))} disabled={dayOffset===0}>‹</button>
            <label className="day-label-wrap">
              <span className="day-label">{getDateLabel(dayOffset)}</span>
              <span className="calendar-icon">📅</span>
              <input
                type="date"
                className="date-input-hidden"
                autoComplete="off"
                data-form-type="other"
                data-lpignore="true"
                value={(() => { const d = new Date(); d.setDate(d.getDate() + dayOffset); return dateStr(d); })()}
                min={dateStr(new Date())}
                max={(() => { const d = new Date(); d.setDate(d.getDate() + 13); return dateStr(d); })()}
                onChange={e => {
                  const picked = new Date(e.target.value + 'T00:00:00');
                  const today = new Date(); today.setHours(0,0,0,0);
                  const diff = Math.round((picked - today) / 86400000);
                  setDayOffset(Math.max(0, Math.min(13, diff)));
                }}
              />
            </label>
            <button className="day-arrow" onClick={() => setDayOffset(Math.min(13, dayOffset+1))}>›</button>
          </div>

          {/* Schedule list */}
          <div className="schedule-list">
            {loading && <div className="empty-state">Loading schedule…</div>}

            {!loading && grouped.length === 0 && (
              <div className="empty-state">No {mode === 'lap' ? 'lap' : 'family'} swim sessions found for this day.</div>
            )}

            {!loading && grouped.map(([time, slotSessions]) => (
              <div key={time} className="time-block">
                <div className="time-header">{time}</div>
                {slotSessions.map((s) => {
                  const rowKey = `${s.poolId}-${s.start}-${s.end}-${s.type}`;
                  return (
                  <div key={rowKey} className={`session-row${favSet.has(s.poolId) ? ' session-row-fav' : ''}`}>
                    <div className="session-left">
                      <div className="pool-name">
                        {getPoolName(s.poolId)}
                        {favSet.has(s.poolId) && <span className="session-fav-star">★</span>}
                      </div>
                      <div className="session-meta">
                        {mode !== 'lap' && (
                          <button
                            className="session-type-btn"
                            onClick={() => setTooltip(tooltip?.key===rowKey ? null : {key:rowKey, type:s.type})}
                          >
                            {SESSION_TYPES[s.type] || s.type}
                          </button>
                        )}
                      </div>
                      {tooltip?.key===rowKey && (
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
                    {s.notes && <div className="session-note">{s.notes}</div>}
                  </div>
                  );
                })}
              </div>
            ))}
          </div>
        </>
      )}

      {/* My Pools tab */}
      {activeTab === 'my-pools' && (
        <MyPools user={user} preferences={preferences} onToggleFavorite={toggleFavorite} onToggleHidden={toggleHidden} />
      )}

      {/* Settings tab */}
      {activeTab === 'settings' && <SettingsTab user={user} />}

      {/* Tab bar */}
      <div className="tab-bar">
        <button className={`tab ${activeTab==='schedule'?'active':''}`} onClick={() => setActiveTab('schedule')}>
          <span className="tab-icon">📅</span>
          <span>Schedule</span>
        </button>
        <button className={`tab ${activeTab==='my-pools'?'active':''}`} onClick={() => setActiveTab('my-pools')}>
          <span className="tab-icon">🏊</span>
          <span>My Pools</span>
        </button>
        <button className={`tab ${activeTab==='settings'?'active':''}`} onClick={() => setActiveTab('settings')}>
          <span className="tab-icon">⚙️</span>
          <span>Settings</span>
        </button>
      </div>
    </div>
  );
}
