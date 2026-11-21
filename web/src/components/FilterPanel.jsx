// Food Place Searching: the filters (radius, label, halal, price, cuisine, dietary,
// open now, rated only). Controlled component: the page owns the filter values.

import { useId, useState } from "react";
import { ChevronDown, RotateCcw, SlidersHorizontal } from "lucide-react";
import { CUISINES, DIETARY_TAGS, RADIUS_MAX, RADIUS_MIN } from "../lib/constants";
import { PRICE_LABELS, capitalise, formatDistance } from "../lib/format";
import "./FilterPanel.css";

const LABEL_OPTIONS = [
  { value: "", text: "All" },
  { value: "hidden_gem", text: "Hidden Gems" },
  { value: "popular", text: "Popular" },
];

function toggleInList(list, value) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export default function FilterPanel({ filters, onChange, onReset }) {
  const [open, setOpen] = useState(true);
  const id = useId();
  const bodyId = `${id}-body`;

  return (
    <section className="filter-panel card" aria-labelledby={`${id}-title`}>
      <div className="filter-panel__head">
        <h2 id={`${id}-title`} className="filter-panel__title">
          <SlidersHorizontal size={18} aria-hidden="true" />
          Filters
        </h2>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? "Hide" : "Show"}
          <ChevronDown
            size={18}
            aria-hidden="true"
            className={`filter-panel__chevron${open ? " is-open" : ""}`}
          />
        </button>
      </div>

      <div id={bodyId} hidden={!open} className="filter-panel__body">
        <div className="field">
          <label htmlFor={`${id}-radius`}>
            Search radius: <span className="tabular">{formatDistance(filters.radius)}</span>
          </label>
          <input
            id={`${id}-radius`}
            type="range"
            min={RADIUS_MIN}
            max={RADIUS_MAX}
            step={100}
            value={filters.radius}
            aria-valuetext={formatDistance(filters.radius)}
            onChange={(e) => onChange({ radius: Number(e.target.value) })}
          />
        </div>

        <fieldset>
          <legend>Show</legend>
          <div className="segmented">
            {LABEL_OPTIONS.map((o) => (
              <label key={o.value || "all"}>
                <input
                  type="radio"
                  name={`${id}-label`}
                  value={o.value}
                  checked={filters.label === o.value}
                  onChange={() => onChange({ label: o.value })}
                />
                {o.text}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="filter-panel__checks">
          <label className="check">
            <input
              type="checkbox"
              checked={filters.halal}
              onChange={(e) => onChange({ halal: e.target.checked })}
            />
            Halal only
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={filters.openNow}
              onChange={(e) => onChange({ openNow: e.target.checked })}
            />
            Open now
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={filters.ratedOnly}
              aria-describedby={`${id}-rated-hint`}
              onChange={(e) => onChange({ ratedOnly: e.target.checked })}
            />
            Rated places only
          </label>
          <p id={`${id}-rated-hint`} className="field-hint">
            OpenStreetMap places have no ratings, so they cannot be Hidden Gems. Keep this on to see
            the 55 rated sample places first.
          </p>
        </div>

        <div className="field">
          <label htmlFor={`${id}-price`}>Maximum price</label>
          <select
            id={`${id}-price`}
            className="select"
            value={filters.maxPrice ?? ""}
            onChange={(e) =>
              onChange({ maxPrice: e.target.value === "" ? null : Number(e.target.value) })
            }
          >
            <option value="">Any price</option>
            {[1, 2, 3, 4].map((level) => (
              <option key={level} value={level}>
                {"RM".repeat(level)} · {PRICE_LABELS[level]}
              </option>
            ))}
          </select>
        </div>

        <fieldset>
          <legend>Cuisine</legend>
          <div className="chip-group">
            {CUISINES.map((c) => (
              <label key={c} className="chip">
                <input
                  type="checkbox"
                  checked={filters.cuisine.includes(c)}
                  onChange={() => onChange({ cuisine: toggleInList(filters.cuisine, c) })}
                />
                {capitalise(c)}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend>Dietary needs</legend>
          <div className="chip-group">
            {DIETARY_TAGS.map((d) => (
              <label key={d} className="chip">
                <input
                  type="checkbox"
                  checked={filters.dietary.includes(d)}
                  onChange={() => onChange({ dietary: toggleInList(filters.dietary, d) })}
                />
                {capitalise(d)}
              </label>
            ))}
          </div>
        </fieldset>

        <button type="button" className="btn btn-ghost btn-sm" onClick={onReset}>
          <RotateCcw size={16} aria-hidden="true" />
          Reset filters
        </button>
      </div>
    </section>
  );
}
