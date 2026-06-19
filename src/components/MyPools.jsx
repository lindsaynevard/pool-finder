import { POOLS } from '../data/pools';

const LIVE_POOLS = new Set(['west-campus', 'king', 'golden-bear', 'emeryville', 'albany-indoor', 'albany-outdoor']);

export default function MyPools() {
  const byCity = POOLS.reduce((acc, pool) => {
    if (!acc[pool.city]) acc[pool.city] = [];
    acc[pool.city].push(pool);
    return acc;
  }, {});

  return (
    <div className="tab-content-scroll">
      <div className="pool-list">
        {Object.entries(byCity).map(([city, pools]) => (
          <div key={city} className="pool-city-group">
            <div className="pool-city-header">{city}</div>
            {pools.map(pool => (
              <div key={pool.id} className="pool-list-item">
                <span className="pool-list-name">{pool.name}</span>
                {!LIVE_POOLS.has(pool.id) && (
                  <span className="pool-coming-soon">Coming soon</span>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="tab-footer-note">
        Personalization coming soon — sign in to set your pool order and hide pools you don't use.
      </div>
    </div>
  );
}
