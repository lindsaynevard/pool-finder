import { useState, useRef } from 'react';
import { POOLS } from '../data/pools';
import PoolDetailSheet from './PoolDetailSheet';

const LIVE_POOLS = new Set([
  'west-campus', 'king', 'golden-bear', 'emeryville',
  'albany-indoor', 'albany-outdoor', 'roberts', 'east-oakland',
  'el-cerrito-pool', 'el-cerrito-splash', 'piedmont-lap', 'piedmont-activity', 'defremery', 'lions', 'richmond',
  'richmond-swim-center', 'berkeley-marina', 'mills',
]);

export default function MyPools({ user, preferences, onToggleFavorite, onToggleHidden, onSignIn }) {
  const [favMode, setFavMode] = useState('lap');
  const [selectedPool, setSelectedPool] = useState(null);
  const [nudge, setNudge] = useState(null); // 'star' | 'toggle'
  const nudgeTimer = useRef(null);

  function showNudge(type) {
    if (nudgeTimer.current) clearTimeout(nudgeTimer.current);
    setNudge(type);
    nudgeTimer.current = setTimeout(() => setNudge(null), 4000);
  }

  const favorites = new Set(preferences?.[`${favMode}_favorites`] || []);
  const hidden = new Set(preferences?.[`${favMode}_hidden`] || []);

  const byCity = POOLS.filter(p => p.swimTypes?.includes(favMode)).reduce((acc, pool) => {
    if (!acc[pool.city]) acc[pool.city] = [];
    acc[pool.city].push(pool);
    return acc;
  }, {});

  return (
    <div className="tab-content-scroll">
      <div className="my-pools-header">
        <div className="mode-toggle">
          <button className={`mode-btn ${favMode === 'lap' ? 'active' : ''}`} onClick={() => setFavMode('lap')}>Lap</button>
          <button className={`mode-btn ${favMode === 'family' ? 'active' : ''}`} onClick={() => setFavMode('family')}>Family</button>
        </div>
        {!user && nudge && (
          <div className="signin-nudge">
            <span>
              {nudge === 'star'
                ? 'Sign in to save ★ favorites across devices'
                : 'Sign in to sync your settings across devices'}
            </span>
            <button className="signin-nudge-btn" onClick={onSignIn}>Sign in</button>
          </div>
        )}
      </div>

      <div className="pool-list">
        {Object.entries(byCity).map(([city, pools]) => (
          <div key={city} className="pool-city-group">
            <div className="pool-city-header">{city}</div>
            {pools.map(pool => {
              const isLive = LIVE_POOLS.has(pool.id);
              const isFav = favorites.has(pool.id);
              const isHidden = hidden.has(pool.id);
              return (
                <div key={pool.id} className={`pool-list-item${isHidden ? ' pool-disabled' : ''}`} onClick={() => setSelectedPool(pool)} style={{ cursor: 'pointer' }}>
                  <span className="pool-list-name-wrap">
                    <span className="pool-list-name">{pool.name}</span>
                    <span className="pool-list-chevron">›</span>
                  </span>
                  <div className="pool-list-actions">
                    {!isLive && (
                      <span className="pool-coming-soon">Coming soon</span>
                    )}
                    {isLive && (
                      <>
                        <button
                          className={`pool-star-btn ${isFav ? 'active' : ''}`}
                          onClick={(e) => { e.stopPropagation(); if (!user) { showNudge('star'); return; } onToggleFavorite(pool.id, favMode); }}
                          aria-label={isFav ? `Unfavorite ${pool.name}` : `Favorite ${pool.name}`}
                        >
                          {isFav ? '★' : '☆'}
                        </button>
                        <label
                          className="pool-toggle"
                          onClick={e => e.stopPropagation()}
                          title={isHidden ? 'Hidden from schedule' : 'Showing in schedule'}
                        >
                          <input
                            type="checkbox"
                            checked={!isHidden}
                            onChange={() => { onToggleHidden(pool.id, favMode); if (!user) showNudge('toggle'); }}
                          />
                          <span className="pool-toggle-slider" />
                        </label>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="tab-footer-note">
        {user
          ? 'Starred pools appear first in the schedule.'
          : 'Sign in to save your preferences across devices.'}
      </div>

      <PoolDetailSheet pool={selectedPool} onClose={() => setSelectedPool(null)} />
    </div>
  );
}
