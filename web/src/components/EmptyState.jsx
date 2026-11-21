// Friendly "nothing here yet" message with an optional action.

import { SearchX } from "lucide-react";
import "./States.css";

export default function EmptyState({ icon: Icon = SearchX, title, children, action }) {
  return (
    <div className="state-box">
      <Icon size={36} aria-hidden="true" className="state-box__icon" />
      <h2 className="state-box__title">{title}</h2>
      {children && <div className="state-box__text">{children}</div>}
      {action && <div className="state-box__action">{action}</div>}
    </div>
  );
}
