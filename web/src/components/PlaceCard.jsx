// Food Place Searching: one place in the result list.

import { Check, Info, MapPin, Plus, Star } from "lucide-react";
import LabelBadge from "./LabelBadge";
import { capitalise, formatDistance, formatHalal, formatPrice, formatRating } from "../lib/format";
import "./PlaceCard.css";

export default function PlaceCard({
  place,
  selected = false,
  highlighted = false,
  inTrip = false,
  tripFull = false,
  onSelect,
  onHover,
  onAddToTrip,
}) {
  const price = formatPrice(place.priceLevel);
  const titleId = `place-${place.id}-title`;
  const classes = ["place-card", "card"];
  if (selected) classes.push("place-card--selected");
  if (highlighted) classes.push("place-card--highlighted");
  if (place.label === "Hidden Gem") classes.push("place-card--gem");

  return (
    <article
      className={classes.join(" ")}
      aria-labelledby={titleId}
      data-place-id={place.id}
      onMouseEnter={() => onHover?.(place.id)}
      onMouseLeave={() => onHover?.(null)}
    >
      <div className="place-card__top">
        <h3 id={titleId} className="place-card__name">
          {place.name}
        </h3>
        <LabelBadge label={place.label} size="sm" />
      </div>

      <p className="place-card__meta">
        {capitalise(place.cuisine) || "Cuisine unknown"}
        {place.area ? ` · ${place.area}` : ""}
      </p>

      <ul className="place-card__facts" aria-label="Details">
        <li>
          <Star size={16} aria-hidden="true" className="place-card__star" />
          <span className="tabular">
            <strong>{formatRating(place.avgRating)}</strong>
            {place.avgRating != null && (
              <span className="muted"> ({place.reviewCount ?? 0} reviews)</span>
            )}
          </span>
        </li>
        {price.symbol && (
          <li>
            <span aria-hidden="true" className="tabular">
              {price.symbol}
            </span>
            <span className="visually-hidden">{price.text}</span>
          </li>
        )}
        <li>{formatHalal(place.isHalal)}</li>
        {place.distanceM != null && (
          <li>
            <MapPin size={16} aria-hidden="true" />
            <span className="tabular">{formatDistance(place.distanceM)}</span>
          </li>
        )}
      </ul>

      <div className="place-card__actions">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          aria-label={`Details for ${place.name}`}
          onClick={() => onSelect?.(place.id)}
          onFocus={() => onHover?.(place.id)}
          onBlur={() => onHover?.(null)}
        >
          <Info size={18} aria-hidden="true" />
          Details
        </button>
        <button
          type="button"
          className={`btn btn-sm ${inTrip ? "btn-secondary" : "btn-primary"}`}
          aria-label={`${inTrip ? "In trip" : "Add to trip"}: ${place.name}`}
          onClick={() => onAddToTrip?.(place)}
          disabled={inTrip || tripFull}
          title={tripFull && !inTrip ? "Your trip already has 10 stops" : undefined}
        >
          {inTrip ? <Check size={18} aria-hidden="true" /> : <Plus size={18} aria-hidden="true" />}
          {inTrip ? "In trip" : "Add to trip"}
        </button>
      </div>
    </article>
  );
}
