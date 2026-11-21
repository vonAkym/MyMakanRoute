// Grey placeholder blocks while data loads (no layout jump when the data arrives).

import "./States.css";

export default function LoadingSkeleton({ count = 3, height = 96, label = "Loading" }) {
  return (
    <div className="skeleton-list" role="status" aria-live="polite">
      <span className="visually-hidden">{label}…</span>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="skeleton" style={{ height }} aria-hidden="true" />
      ))}
    </div>
  );
}
