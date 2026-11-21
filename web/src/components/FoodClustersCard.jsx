// Food Places Analysis: food clusters found by DBSCAN (groups of food places close together).
// Hidden gem areas (highly rated, few reviews) are listed first and marked.

import { Gem, MapPinned } from "lucide-react";
import { formatRating } from "../lib/format";
import "./LabelBadge.css";
import "./SuggestionsCard.css";

const SHOWN = 6;

export default function FoodClustersCard({ clusters, className = "" }) {
  const list = clusters?.clusters ?? [];
  if (list.length === 0) return null;
  const { epsM, minPoints } = clusters.settings;
  const shown = [...list]
    .sort((a, b) => Number(b.isHiddenGemArea) - Number(a.isHiddenGemArea) || b.places - a.places)
    .slice(0, SHOWN);

  return (
    <section className={`card ${className}`.trim()} aria-labelledby="clusters-title">
      <h2 id="clusters-title" className="findings__title">
        <MapPinned size={20} aria-hidden="true" />
        Food clusters
      </h2>
      <p className="muted small">
        DBSCAN grouped places that stand within {epsM} m of each other, at least {minPoints} per
        group: {list.length} clusters, {clusters.noisePlaces} places on their own.
      </p>
      <ol className="suggestions">
        {shown.map((c) => (
          <li key={c.id} className="suggestion">
            <div>
              <strong className="suggestion__name">
                {c.area} · {c.places} places
              </strong>
              <span className="muted small">
                {c.ratedPlaces > 0
                  ? `${formatRating(c.averageRating)} average from ${c.ratedPlaces} rated` +
                    ` · median ${c.medianReviews} reviews`
                  : "No rated places yet"}
              </span>
              {c.topPlaces.length > 0 && (
                <span className="small">Best rated: {c.topPlaces.join(", ")}</span>
              )}
            </div>
            {c.isHiddenGemArea && (
              <span className="label-badge label-badge--gem label-badge--sm">
                <Gem size={14} aria-hidden="true" />
                Hidden gem area
              </span>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
