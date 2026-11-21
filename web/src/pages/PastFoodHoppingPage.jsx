// Food Hopping module page (/trips): Past Food Hopping Visualisation.
// Lists trips saved on this device and shows the chosen one on the map.

import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Car, Footprints, History, MapPinned, Search, Trash2 } from "lucide-react";
import { deleteSavedTrip, listSavedTrips } from "../api/foodHopping";
import PlaceMap from "../components/PlaceMap";
import EmptyState from "../components/EmptyState";
import LoadingSkeleton from "../components/LoadingSkeleton";
import usePageTitle from "../hooks/usePageTitle";
import { formatDateTime, formatDistance, formatDuration } from "../lib/format";
import "./PastFoodHoppingPage.css";

export default function PastFoodHoppingPage() {
  usePageTitle("My trips");
  const [trips, setTrips] = useState(null);
  const [params, setParams] = useSearchParams();
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    let active = true;
    listSavedTrips().then((list) => {
      if (active) setTrips(list);
    });
    return () => {
      active = false;
    };
  }, []);

  const selectedId = params.get("trip") ?? trips?.[0]?.id ?? null;
  const selected = trips?.find((t) => t.id === selectedId) ?? null;

  async function onDelete(trip) {
    if (!window.confirm(`Delete the trip "${trip.name}"? This cannot be undone.`)) return;
    await deleteSavedTrip(trip.id);
    const list = await listSavedTrips();
    setTrips(list);
    setParams({}, { replace: true });
    setAnnouncement(`Trip "${trip.name}" deleted.`);
  }

  return (
    <div className="container page">
      <header className="page-header">
        <span className="eyebrow">Food Hopping</span>
        <h1>My trips</h1>
        <p>Food hops you saved. They are stored on this device only for now.</p>
      </header>

      {trips === null && <LoadingSkeleton count={2} label="Loading saved trips" />}

      {trips?.length === 0 && (
        <EmptyState
          icon={History}
          title="No saved trips yet"
          action={
            <Link to="/discover" className="btn btn-primary">
              <Search size={18} aria-hidden="true" />
              Start on Discover
            </Link>
          }
        >
          <p>Add places to a trip, plan the route, then press “Save trip”.</p>
        </EmptyState>
      )}

      {trips?.length > 0 && (
        <div className="past-layout">
          <section aria-labelledby="saved-title">
            <h2 id="saved-title" className="visually-hidden">
              Saved trips
            </h2>
            <ul className="trip-list">
              {trips.map((trip) => {
                const isSelected = trip.id === selected?.id;
                const r = trip.route;
                return (
                  <li key={trip.id}>
                    <article className={`card trip-card${isSelected ? " is-selected" : ""}`}>
                      <h3 className="trip-card__name">{trip.name}</h3>
                      <p className="muted small">Saved {formatDateTime(trip.savedAt)}</p>
                      <p className="trip-card__facts tabular">
                        {r.travelMode === "driving" ? (
                          <Car size={16} aria-hidden="true" />
                        ) : (
                          <Footprints size={16} aria-hidden="true" />
                        )}
                        {r.stops.length} stops · {formatDuration(r.totalTimeS)} ·{" "}
                        {formatDistance(r.totalDistanceM)}
                      </p>
                      <div className="row">
                        <button
                          type="button"
                          className={`btn btn-sm ${isSelected ? "btn-secondary" : "btn-primary"}`}
                          aria-pressed={isSelected}
                          aria-label={`Show on map: ${trip.name}`}
                          onClick={() => setParams({ trip: trip.id })}
                        >
                          <MapPinned size={16} aria-hidden="true" />
                          {isSelected ? "Shown on map" : "Show on map"}
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          aria-label={`Delete: ${trip.name}`}
                          onClick={() => onDelete(trip)}
                        >
                          <Trash2 size={16} aria-hidden="true" />
                          Delete
                        </button>
                      </div>
                    </article>
                  </li>
                );
              })}
            </ul>
          </section>

          {selected && (
            <section className="past-detail" aria-labelledby="trip-detail-title">
              <div className="past-map">
                <PlaceMap
                  key={selected.id}
                  places={selected.route.stops}
                  legs={selected.route.legs}
                  numbered
                  label={`Map of the trip ${selected.name}`}
                />
              </div>
              <div className="card">
                <h2 id="trip-detail-title">{selected.name}</h2>
                <ol className="past-stops">
                  {selected.route.stops.map((stop, i) => {
                    const leg = selected.route.legs.find((l) => l.fromId === stop.id);
                    return (
                      <li key={stop.id}>
                        <strong>{stop.name}</strong>
                        {leg && (
                          <span className="muted small tabular">
                            {" "}
                            then {formatDuration(leg.timeS)} ({formatDistance(leg.distanceM)}) to
                            stop {i + 2}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </div>
            </section>
          )}
        </div>
      )}

      <div className="visually-hidden" role="status" aria-live="polite">
        {announcement}
      </div>
    </div>
  );
}
