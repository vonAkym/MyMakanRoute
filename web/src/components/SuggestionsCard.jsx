// Food Place Suggestion (UC-10, FR-FA-03, FR-FA-04): up to 5 "Suggested for you" places,
// shown on the Analytics page and the Discover page.
// - Based on preferences: says which features matched (cuisine, price, area, hidden gem).
// - Based on findings only (no preferences or trips yet): invites the user to set them.
// - Nothing matches: the whole section is hidden (UC-10 alternative flow 3a).
// Suggestions are places within 3 km of the user's location (nearName).

import { Link } from "react-router-dom";
import { Star } from "lucide-react";
import LabelBadge from "./LabelBadge";
import { capitalise, formatDistance, formatHalal, formatRating } from "../lib/format";
import "./SuggestionsCard.css";

const MATCH_WORDS = {
  cuisine: "your cuisine",
  price: "your price level",
  area: "an area you visited",
  "hidden gem": "hidden gem",
};

export function describeMatch(matchedOn = []) {
  const words = matchedOn.map((m) => MATCH_WORDS[m] ?? m);
  return words.length > 0 ? `Matches ${words.join(", ")}` : "";
}

export default function SuggestionsCard({
  suggestions,
  basedOn,
  onOpen,
  className = "",
  children,
}) {
  if (!suggestions || suggestions.length === 0) return null;
  const byPreferences = basedOn === "preferences";

  return (
    <section className={`card ${className}`.trim()} aria-labelledby="suggest-title">
      <h2 id="suggest-title">Suggested for you</h2>
      {byPreferences ? (
        <p className="muted small">
          Places that match your preferences and past trips, best matches first.
        </p>
      ) : (
        <p className="muted small">
          Best rated hidden gems. <Link to="/profile">Set your preferences</Link> to get suggestions
          that fit you.
        </p>
      )}
      <ol className="suggestions">
        {suggestions.map((s) => (
          <li key={s.id} className="suggestion">
            <div>
              {onOpen ? (
                <button type="button" className="suggestion__open" onClick={() => onOpen(s)}>
                  <strong className="suggestion__name">{s.name}</strong>
                </button>
              ) : (
                <strong className="suggestion__name">{s.name}</strong>
              )}
              <span className="muted small">
                {capitalise(s.cuisine)} · {s.area} · {formatHalal(s.isHalal)}
                {s.distanceM != null && ` · ${formatDistance(s.distanceM)} away`}
              </span>
              {byPreferences && (
                <span className="small suggestion__why">
                  {s.matchScore != null && `${Math.round(s.matchScore * 100)}% match · `}
                  {describeMatch(s.matchedOn)}
                </span>
              )}
            </div>
            <div className="suggestion__right">
              <span className="tabular">
                <Star size={14} aria-hidden="true" className="suggestion__star" />
                {formatRating(s.avgRating)} ({s.reviewCount})
              </span>
              <LabelBadge label={s.label} size="sm" />
            </div>
          </li>
        ))}
      </ol>
      {children}
    </section>
  );
}
