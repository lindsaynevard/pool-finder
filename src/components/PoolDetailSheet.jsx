export default function PoolDetailSheet({ pool, onClose }) {
  if (!pool) return null;

  return (
    <>
      <div className="pool-sheet-overlay" onClick={onClose} />
      <div className="pool-sheet">
        <span className="pool-sheet-handle" />
        <div className="pool-sheet-name">{pool.name}</div>
        <div className="pool-sheet-city">{pool.city}, CA</div>
        <div className="pool-sheet-divider" />
        <div className="pool-sheet-row">
          <span className="pool-sheet-label">Email alerts</span>
          {pool.mailingList?.subscribed
            ? <span className="pool-sheet-badge">✓  Subscribed</span>
            : pool.mailingList !== null
            ? <span className="pool-sheet-no-alerts">Not subscribed</span>
            : <span className="pool-sheet-no-alerts">No email list</span>
          }
        </div>
        {pool.mapsUrl && (
          <a href={pool.mapsUrl} target="_blank" rel="noopener noreferrer" className="pool-sheet-maps-btn">
            View on Maps ↗
          </a>
        )}
      </div>
    </>
  );
}
