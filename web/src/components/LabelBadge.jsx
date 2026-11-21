// Hidden Gem Highlighting: the label badge. Always icon + text, never colour alone.

import { Gem, Flame } from "lucide-react";
import "./LabelBadge.css";

export const LABEL_HIDDEN_GEM = "Hidden Gem";
export const LABEL_POPULAR = "Popular";

export default function LabelBadge({ label, size = "md" }) {
  if (label === LABEL_HIDDEN_GEM) {
    return (
      <span className={`label-badge label-badge--gem label-badge--${size}`}>
        <Gem size={size === "sm" ? 14 : 16} aria-hidden="true" />
        Hidden Gem
      </span>
    );
  }
  if (label === LABEL_POPULAR) {
    return (
      <span className={`label-badge label-badge--popular label-badge--${size}`}>
        <Flame size={size === "sm" ? 14 : 16} aria-hidden="true" />
        Popular
      </span>
    );
  }
  return null;
}
