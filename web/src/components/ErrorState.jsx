// Error message with a clear way to recover (retry).

import { AlertTriangle, RotateCcw } from "lucide-react";
import "./States.css";

export default function ErrorState({ title = "Something went wrong", error, onRetry, children }) {
  return (
    <div className="state-box state-box--error" role="alert">
      <AlertTriangle size={36} aria-hidden="true" className="state-box__icon" />
      <h2 className="state-box__title">{title}</h2>
      <div className="state-box__text">
        {error?.message && <p>{error.message}</p>}
        {children}
      </div>
      {onRetry && (
        <div className="state-box__action">
          <button type="button" className="btn btn-secondary" onClick={onRetry}>
            <RotateCcw size={18} aria-hidden="true" />
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
