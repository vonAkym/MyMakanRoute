// One featured place on the landing page: picture, Hidden Gem / Popular label, save button,
// name, cuisine and area, rating and price range. (Separate from components/PlaceCard.jsx,
// which Discover uses; merging them is a later step.)

import { useState } from "react";
import { Flame, Gem, Heart, MapPin, Star } from "lucide-react";
import { PRICE_RANGES } from "../../data/landingContent";
import useSavedPlaces from "../../hooks/useSavedPlaces";
import useReducedMotion from "../../hooks/useReducedMotion";
import "./PlaceCard.css";

export default function PlaceCard({ place }) {
  const { isSaved, toggleSaved } = useSavedPlaces();
  const reducedMotion = useReducedMotion();
  const [popCount, setPopCount] = useState(0); // bumps on each save click
  const saved = isSaved(place.id);
  const gem = place.label === "Hidden Gem";

  function onSave() {
    toggleSaved(place.id);
    // Small "pop" on the heart (skipped with reduced motion). A new key re-mounts the icon,
    // so the animation restarts on every click, even fast repeated ones.
    if (!reducedMotion) setPopCount((n) => n + 1);
  }

  return (
    <article className="lp-place">
      <div className="lp-place__media">
        <img
          src={place.image.src}
          alt={place.image.alt}
          width={place.image.width}
          height={place.image.height}
          loading="lazy"
          decoding="async"
        />
        <span className={`lp-place__label${gem ? " lp-place__label--gem" : ""}`}>
          {gem ? <Gem size={14} aria-hidden="true" /> : <Flame size={14} aria-hidden="true" />}
          {place.label}
        </span>
        <button
          type="button"
          className={`lp-place__save${saved ? " is-saved" : ""}`}
          aria-pressed={saved}
          aria-label={`Save ${place.name}`}
          onClick={onSave}
        >
          <Heart
            key={popCount}
            className={popCount > 0 ? "lp-place__heart--pop" : undefined}
            size={18}
            aria-hidden="true"
            fill={saved ? "currentColor" : "none"}
          />
        </button>
      </div>

      <div className="lp-place__body">
        <h3 className="lp-place__name">{place.name}</h3>
        {place.description && <p className="lp-place__description">{place.description}</p>}
        <p className="lp-place__meta">
          <MapPin size={14} aria-hidden="true" />
          {place.cuisine} · {place.area}
          {place.halal && <span className="lp-place__halal">Halal</span>}
        </p>
        <div className="lp-place__footer">
          <p className="lp-place__rating">
            <Star size={16} aria-hidden="true" fill="currentColor" />
            <strong>{place.rating.toFixed(1)}</strong>
            <span className="lp-place__reviews">
              ({place.reviewCount.toLocaleString("en-MY")} reviews)
            </span>
          </p>
          <p className="lp-place__price">
            <span className="visually-hidden">Price per person: </span>
            {PRICE_RANGES[place.priceLevel]}
          </p>
        </div>
      </div>
    </article>
  );
}
