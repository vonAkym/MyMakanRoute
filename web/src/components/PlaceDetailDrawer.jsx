// Food Place Visualisation: side panel with one place's details (GET /api/discovery/places/:id),
// including opening hours. Closes with the X button, the Escape key or the backdrop.

import { useEffect, useRef, useState } from "react";
import { Check, Clock, Plus, X } from "lucide-react";
import { getFoodPlace } from "../api/foodDiscovery";
import LabelBadge from "./LabelBadge";
import LoadingSkeleton from "./LoadingSkeleton";
import ErrorState from "./ErrorState";
import {
  capitalise,
  formatDistance,
  formatHalal,
  formatOpeningHours,
  formatPrice,
  formatRating,
} from "../lib/format";
import "./PlaceDetailDrawer.css";

export default function PlaceDetailDrawer({
  placeId,
  fallbackPlace,
  onClose,
  inTrip,
  tripFull,
  onAddToTrip,
}) {
  const [state, setState] = useState({ status: "loading", place: null, error: null });
  const [attempt, setAttempt] = useState(0);
  const closeRef = useRef(null);
  const openerRef = useRef(null);
  const drawerRef = useRef(null);

  // Remember what had focus so it can get focus back when the panel closes.
  useEffect(() => {
    openerRef.current = document.activeElement;
    closeRef.current?.focus();
    return () => openerRef.current?.focus?.();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    getFoodPlace(placeId, { signal: controller.signal })
      .then((data) => setState({ status: "ready", place: data.place, error: null }))
      .catch((error) => {
        if (error.name !== "AbortError") setState({ status: "error", place: null, error });
      });
    return () => controller.abort();
  }, [placeId, attempt]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      // Keep Tab inside the open panel (a simple focus trap).
      if (e.key === "Tab" && drawerRef.current) {
        const items = drawerRef.current.querySelectorAll(
          'button:not([disabled]), a[href], input, select, [tabindex]:not([tabindex="-1"])',
        );
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // The list already has distance; the detail call does not (no search centre).
  const place = state.place ? { ...fallbackPlace, ...state.place } : fallbackPlace;
  const hours = formatOpeningHours(place?.openingHours);
  const price = formatPrice(place?.priceLevel);

  return (
    <div className="drawer-root">
      <div className="drawer-backdrop" onClick={onClose} aria-hidden="true" />
      <aside
        ref={drawerRef}
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
      >
        <div className="drawer__head">
          <h2 id="drawer-title" className="drawer__title">
            {place?.name ?? "Place details"}
          </h2>
          <button
            ref={closeRef}
            type="button"
            className="icon-btn"
            aria-label="Close details"
            onClick={onClose}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {state.status === "loading" && !place && <LoadingSkeleton count={3} height={48} />}
        {state.status === "error" && (
          <ErrorState
            title="Could not load this place"
            error={state.error}
            onRetry={() => {
              setState({ status: "loading", place: null, error: null });
              setAttempt((a) => a + 1);
            }}
          />
        )}

        {place && (
          <div className="drawer__body">
            <LabelBadge label={place.label} />
            <dl className="detail-list">
              <dt>Cuisine</dt>
              <dd>{capitalise(place.cuisine) || "Unknown"}</dd>
              <dt>Area</dt>
              <dd>{place.area || "Unknown"}</dd>
              {place.address && (
                <>
                  <dt>Address</dt>
                  <dd>{place.address}</dd>
                </>
              )}
              <dt>Rating</dt>
              <dd className="tabular">
                {formatRating(place.avgRating)}
                {place.avgRating != null && ` from ${place.reviewCount ?? 0} reviews`}
                {place.isSample && <span className="muted"> (sample, invented)</span>}
              </dd>
              <dt>Price</dt>
              <dd>{price.text}</dd>
              <dt>Halal</dt>
              <dd>{formatHalal(place.isHalal)}</dd>
              {place.dietary?.length > 0 && (
                <>
                  <dt>Dietary</dt>
                  <dd>{place.dietary.map(capitalise).join(", ")}</dd>
                </>
              )}
              {place.distanceM != null && (
                <>
                  <dt>Distance</dt>
                  <dd className="tabular">{formatDistance(place.distanceM)} from search point</dd>
                </>
              )}
            </dl>

            <h3 className="drawer__subtitle">
              <Clock size={18} aria-hidden="true" />
              Opening hours
            </h3>
            {hours.length > 0 ? (
              <table className="hours-table">
                <tbody>
                  {hours.map((h) => (
                    <tr key={h.day}>
                      <th scope="row">{h.day}</th>
                      <td>{h.text}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="muted">
                {place.openingHours?.osm
                  ? `From OpenStreetMap: ${place.openingHours.osm}`
                  : "Opening hours are not known."}
              </p>
            )}

            <button
              type="button"
              className={`btn ${inTrip ? "btn-secondary" : "btn-primary"} drawer__cta`}
              onClick={() => onAddToTrip(place)}
              disabled={inTrip || tripFull}
            >
              {inTrip ? (
                <Check size={18} aria-hidden="true" />
              ) : (
                <Plus size={18} aria-hidden="true" />
              )}
              {inTrip
                ? "Already in your trip"
                : tripFull
                  ? "Trip is full (10 stops)"
                  : "Add to trip"}
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}
