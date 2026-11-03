// Food Hopping module page (/trip):
//   Itinerary Planner                    -> trip basket, start stop, travel mode
//   Route Planner                        -> POST /api/hopping/route (Dijkstra + ACO), map, legs
//   Itinerary Review and Customisation   -> remove, move up/down, re-plan, save

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDown,
  ArrowUp,
  Car,
  Footprints,
  Route as RouteIcon,
  Save,
  Search,
  Trash2,
  Wand2,
} from "lucide-react";
import { planRoute, saveTrip } from "../api/foodHopping";
import { useTripBasket, MAX_TRIP_STOPS } from "../context/TripBasketContext";
import PlaceMap from "../components/PlaceMap";
import LabelBadge from "../components/LabelBadge";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import LoadingSkeleton from "../components/LoadingSkeleton";
import AlgorithmComparisonCard from "../components/AlgorithmComparisonCard";
import SampleDataBanner from "../components/SampleDataBanner";
import usePageTitle from "../hooks/usePageTitle";
import { formatDistance, formatDuration } from "../lib/format";
import "./ItineraryPlannerPage.css";

const SAMPLE_NOTE = "Ratings for sample places are invented for testing.";

// Friendly text for the errors the route planner can return.
function routeErrorHint(error) {
  switch (error?.code) {
    case "NETWORK_ERROR":
      return "The backend is not reachable. Start it with npm run dev in the backend folder.";
    case "NOT_FOUND":
      return error.status === 404 && !error.details
        ? "The route planner is not available on this server yet."
        : "Some places in your trip no longer exist. Remove them and try again.";
    case "PLACE_NOT_ON_ROAD_GRAPH":
      return "One stop is too far from any road on the map. Remove it and try again.";
    case "ROUTE_UNREACHABLE":
      return "Some stops cannot be reached from each other by road. Try other stops.";
    default:
      return "The route planner may still be preparing its road map. Your stops are kept, so you can try again later.";
  }
}

const defaultTripName = () =>
  `Food hop ${new Date().toLocaleDateString("en-MY", { day: "numeric", month: "short" })}`;

export default function ItineraryPlannerPage() {
  usePageTitle("Plan your food hop");
  const basket = useTripBasket();
  const stops = basket.places;

  const [travelMode, setTravelMode] = useState("walking");
  const [startId, setStartId] = useState(stops[0]?.id ?? "");
  const [plan, setPlan] = useState({ status: "idle", route: null, error: null, mode: null });
  const [tripName, setTripName] = useState(defaultTripName);
  const [saved, setSaved] = useState(null);
  const [announcement, setAnnouncement] = useState("");

  // Keep the chosen start valid when stops are removed.
  const validStartId = stops.some((s) => s.id === startId) ? startId : (stops[0]?.id ?? "");

  const route = plan.route;
  // The route is out of date when the stops, their order or the travel mode changed.
  const stale =
    !route ||
    plan.mode !== travelMode ||
    route.stops.map((s) => s.id).join() !== stops.map((s) => s.id).join();

  const legsByFrom = useMemo(() => {
    const map = new Map();
    if (route && !stale) route.legs.forEach((leg) => map.set(leg.fromId, leg));
    return map;
  }, [route, stale]);

  async function runPlanner() {
    if (stops.length < 2) return;
    setPlan((p) => ({ ...p, status: "loading", error: null }));
    setSaved(null);
    try {
      const result = await planRoute({
        placeIds: stops.map((s) => s.id),
        travelMode,
        startPlaceId: validStartId || undefined,
      });
      // Show the stops in the order ACO chose.
      basket.setOrder(result.stops.map((s) => s.id));
      setPlan({ status: "ready", route: result, error: null, mode: travelMode });
      setAnnouncement(
        `Route planned: ${result.stops.length} stops, ${formatDuration(result.totalTimeS)} in total.`,
      );
    } catch (error) {
      setPlan((p) => ({ ...p, status: "error", error }));
    }
  }

  async function onSave() {
    if (!route || stale) return;
    const trip = await saveTrip({ name: tripName.trim() || defaultTripName(), route });
    setSaved(trip);
    setAnnouncement(`Trip "${trip.name}" saved on this device.`);
  }

  function move(id, direction, name) {
    basket.movePlace(id, direction);
    setAnnouncement(`${name} moved ${direction < 0 ? "up" : "down"}.`);
  }

  function remove(id, name) {
    basket.removePlace(id);
    setAnnouncement(`${name} removed from your trip.`);
  }

  if (stops.length < 2) {
    return (
      <div className="container page">
        <header className="page-header">
          <span className="eyebrow">Food Hopping</span>
          <h1>Plan your food hop</h1>
        </header>
        <EmptyState
          icon={RouteIcon}
          title={stops.length === 0 ? "Your trip is empty" : "Add one more place"}
          action={
            <Link to="/discover" className="btn btn-primary">
              <Search size={18} aria-hidden="true" />
              Find places on Discover
            </Link>
          }
        >
          <p>
            A food hop needs at least 2 stops (up to {MAX_TRIP_STOPS}). Press “Add to trip” on any
            place in Discover.
          </p>
          {stops.length === 1 && <p>In your trip now: {stops[0].name}.</p>}
        </EmptyState>
      </div>
    );
  }

  const mapStops = route && !stale ? route.stops : stops;
  const hasSample = stops.some((s) => s.isSample);

  return (
    <div className="container page">
      <header className="page-header">
        <span className="eyebrow">Food Hopping</span>
        <h1>Plan your food hop</h1>
        <p>
          Pick where you start and how you travel. The planner finds travel times on real Penang
          roads (Dijkstra) and the best visiting order (Ant Colony Optimisation).
        </p>
      </header>

      <div className="trip-layout">
        <div className="trip-side">
          <section className="card" aria-labelledby="trip-settings-title">
            <h2 id="trip-settings-title">Trip settings</h2>
            <div className="field">
              <label htmlFor="start-stop">Start at</label>
              <select
                id="start-stop"
                className="select"
                value={validStartId}
                onChange={(e) => setStartId(e.target.value)}
              >
                {stops.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <fieldset>
              <legend>Travel mode</legend>
              <div className="segmented">
                <label>
                  <input
                    type="radio"
                    name="travel-mode"
                    value="walking"
                    checked={travelMode === "walking"}
                    onChange={() => setTravelMode("walking")}
                  />
                  <Footprints size={16} aria-hidden="true" /> Walking
                </label>
                <label>
                  <input
                    type="radio"
                    name="travel-mode"
                    value="driving"
                    checked={travelMode === "driving"}
                    onChange={() => setTravelMode("driving")}
                  />
                  <Car size={16} aria-hidden="true" /> Driving
                </label>
              </div>
            </fieldset>
            <button
              type="button"
              className="btn btn-primary trip-plan-btn"
              onClick={runPlanner}
              disabled={plan.status === "loading"}
              aria-busy={plan.status === "loading"}
            >
              {route ? (
                <Wand2 size={18} aria-hidden="true" />
              ) : (
                <RouteIcon size={18} aria-hidden="true" />
              )}
              {plan.status === "loading" ? "Planning…" : route ? "Re-plan with ACO" : "Plan route"}
            </button>
            {route && stale && plan.status !== "loading" && (
              <p className="field-hint" role="status" style={{ marginTop: "var(--space-sm)" }}>
                You changed the trip. Press “Re-plan with ACO” to update the route.
              </p>
            )}
          </section>

          <section className="card" aria-labelledby="stops-title">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <h2 id="stops-title" style={{ margin: 0 }}>
                Stops ({stops.length}/{MAX_TRIP_STOPS})
              </h2>
              <Link to="/discover" className="btn btn-ghost btn-sm">
                <Search size={16} aria-hidden="true" />
                Add more
              </Link>
            </div>
            {hasSample && <SampleDataBanner note={SAMPLE_NOTE} />}
            <ol className="stop-list">
              {stops.map((stop, index) => {
                const leg = legsByFrom.get(stop.id);
                return (
                  <li key={stop.id} className="stop-item">
                    <div className="stop">
                      <span className="stop__number" aria-hidden="true">
                        {index + 1}
                      </span>
                      <div className="stop__body">
                        <span className="stop__name">
                          <span className="visually-hidden">Stop {index + 1}: </span>
                          {stop.name}
                        </span>
                        <span className="stop__meta">
                          {stop.area ?? ""}
                          {stop.id === validStartId && <span className="stop__start">Start</span>}
                          <LabelBadge label={stop.label} size="sm" />
                        </span>
                      </div>
                      <div className="stop__actions">
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label={`Move ${stop.name} up`}
                          disabled={index === 0}
                          onClick={() => move(stop.id, -1, stop.name)}
                        >
                          <ArrowUp size={18} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label={`Move ${stop.name} down`}
                          disabled={index === stops.length - 1}
                          onClick={() => move(stop.id, 1, stop.name)}
                        >
                          <ArrowDown size={18} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className="icon-btn icon-btn--danger"
                          aria-label={`Remove ${stop.name}`}
                          onClick={() => remove(stop.id, stop.name)}
                        >
                          <Trash2 size={18} aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                    {leg && (
                      <p className="leg">
                        {travelMode === "walking" ? (
                          <Footprints size={16} aria-hidden="true" />
                        ) : (
                          <Car size={16} aria-hidden="true" />
                        )}
                        <span className="tabular">
                          {formatDuration(leg.timeS)} · {formatDistance(leg.distanceM)}
                        </span>
                        <span className="visually-hidden"> to the next stop</span>
                      </p>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>

          {plan.status === "loading" && (
            <LoadingSkeleton count={2} height={120} label="Planning route" />
          )}

          {plan.status === "error" && (
            <ErrorState title="Could not plan the route" error={plan.error} onRetry={runPlanner}>
              <p>{routeErrorHint(plan.error)}</p>
            </ErrorState>
          )}

          {route && !stale && plan.status === "ready" && (
            <>
              <section className="card trip-summary" aria-labelledby="summary-title">
                <h2 id="summary-title">Your route</h2>
                <dl className="kpi-row">
                  <div>
                    <dt>Total time</dt>
                    <dd className="tabular">{formatDuration(route.totalTimeS)}</dd>
                  </div>
                  <div>
                    <dt>Distance</dt>
                    <dd className="tabular">{formatDistance(route.totalDistanceM)}</dd>
                  </div>
                  <div>
                    <dt>Stops</dt>
                    <dd className="tabular">{route.stops.length}</dd>
                  </div>
                </dl>
                <p className="muted small">
                  {route.travelMode === "walking" ? "Walking" : "Driving"} time only, not counting
                  time spent eating. Open route: it starts at stop 1 and does not return.
                </p>

                <div className="field" style={{ marginTop: "var(--space-md)" }}>
                  <label htmlFor="trip-name">Trip name</label>
                  <input
                    id="trip-name"
                    className="input"
                    maxLength={80}
                    value={tripName}
                    onChange={(e) => setTripName(e.target.value)}
                  />
                </div>
                <button type="button" className="btn btn-secondary" onClick={onSave}>
                  <Save size={18} aria-hidden="true" />
                  Save trip
                </button>
                {saved ? (
                  <p
                    className="notice notice-success"
                    role="status"
                    style={{ marginTop: "var(--space-sm)" }}
                  >
                    Saved on this device. <Link to="/trips">See My Trips</Link>
                  </p>
                ) : (
                  <p className="field-hint" style={{ marginTop: "var(--space-sm)" }}>
                    Trips are saved on this device only for now. Saving to your account comes in a
                    later version.
                  </p>
                )}
              </section>

              <AlgorithmComparisonCard
                comparison={route.comparison}
                algorithm={route.algorithm}
                graph={route.graph}
              />
            </>
          )}
        </div>

        <div className="trip-map">
          <PlaceMap
            places={mapStops}
            legs={route && !stale ? route.legs : []}
            numbered
            label="Map of your food hop stops"
          />
        </div>
      </div>

      <div className="visually-hidden" role="status" aria-live="polite">
        {announcement}
      </div>
    </div>
  );
}
