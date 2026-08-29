import { clockTime } from '../lib/api';

/** Shared memory for the scene. Also the handover note when EMS finally walks in. */
export default function SceneLog({ log }) {
  if (!log.length) return <p className="faint">Nothing yet.</p>;

  return (
    <div className="log">
      {log.map((entry) => (
        <div className="log-item" key={`${entry.at}-${entry.text}`}>
          <span className="log-time">{clockTime(entry.at)}</span>
          <span className={`log-${entry.kind}`}>{entry.text}</span>
        </div>
      ))}
    </div>
  );
}
