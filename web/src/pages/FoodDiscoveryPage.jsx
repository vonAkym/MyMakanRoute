// Food Discovery module page (/discover):
//   Food Place Searching      -> location picker, filters, result list
//   Hidden Gem Highlighting   -> labels from the API, gems ranked first, distinct badges/markers
//   Food Place Visualisation  -> map with markers + place detail panel

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Crosshair, List, Map as MapIcon, MapPin, Route, Sparkles } from "lucide-react";
import { searchFoodPlaces } from "../api/foodDiscovery";
import { getPreferences, hasPreferences } from "../api/userManagement";
import { useTripBasket } from "../context/TripBasketContext";
import FilterPanel from "../components/FilterPanel";
import PlaceCard from "../components/PlaceCard";
import PlaceMap from "../components/PlaceMap";
import PlaceDetailDrawer from "../components/PlaceDetailDrawer";
import SampleDataBanner from "../components/SampleDataBanner";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import LoadingSkeleton from "../components/LoadingSkeleton";
import usePageTitle from "../hooks/usePageTitle";
import { LOCATION_PRESETS, RADIUS_DEFAULT } from "../lib/constants";
import { formatDistance } from "../lib/format";
import "./FoodDiscoveryPage.css";

const SEARCH_DELAY_MS = 250; // waits while the radius slider is moving

// Starting filters; saved preferences (Profile page) fill in halal, budget, cuisine, dietary.
export function initialFilters(preferences = getPreferences()) {
  return {
    radius: RADIUS_DEFAULT,
    label: "",
    halal: preferences.halalOnly,
    maxPrice: preferences.maxBudget,
    cuisine: [...preferences.cuisines],
    dietary: [...preferences.dietary],
    openNow: false,
    ratedOnly: true,
  };
}

const NO_PREFERENCES = { halalOnly: false, maxBudget: null, cuisines: [], dietary: [] };

export default function FoodDiscoveryPage() {
  usePageTitle("Discover food");
  const preferences = useMemo(() => getPreferences(), []);
  const usingPreferences = hasPreferences(preferences);

  const [location, setLocation] = useState(LOCATION_PRESETS[0]);
  const [geoMessage, setGeoMessage] = useState("");
  const [locating, setLocating] = useState(false);
  const [filters, setFilters] = useState(() => initialFilters(preferences));
  const [result, setResult] = useState({ status: "loading", places: [], note: null, error: null });
  const [attempt, setAttempt] = useState(0);
  const [selectedId, setSelectedId] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const [view, setView] = useState("list"); // mobile only: "list" | "map"
  const [announcement, setAnnouncement] = useState("");
  const basket = useTripBasket();

  // Server-side filters only; "ratedOnly" is applied below in the browser.
  const { ratedOnly, ...serverFilters } = filters;
  const queryKey = JSON.stringify({ ...serverFilters, lat: location.lat, lng: location.lng });

  useEffect(() => {
    const query = JSON.parse(queryKey);
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setResult((r) => ({ ...r, status: "loading", error: null }));
      searchFoodPlaces(query, { signal: controller.signal })
        .then((data) =>
          setResult({ status: "ready", places: data.places, note: data.note ?? null, error: null }),
        )
        .catch((error) => {
          if (error.name !== "AbortError") {
            setResult({ status: "error", places: [], note: null, error });
          }
        });
    }, SEARCH_DELAY_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [queryKey, attempt]);

  const places = useMemo(
    () => (ratedOnly ? result.places.filter((p) => p.avgRating != null) : result.places),
    [result.places, ratedOnly],
  );
  const gemCount = places.filter((p) => p.label === "Hidden Gem").length;
  const hiddenUnrated = result.places.length - places.length;

  // When a marker is clicked, bring its card into view in the list.
  useEffect(() => {
    if (!selectedId) return;
    const card = document.querySelector(`[data-place-id="${selectedId}"]`);
    card?.scrollIntoView?.({ block: "nearest" });
  }, [selectedId]);

  const updateFilters = useCallback((patch) => setFilters((f) => ({ ...f, ...patch })), []);

  function choosePreset(id) {
    const preset = LOCATION_PRESETS.find((p) => p.id === id);
    if (preset) {
      setLocation(preset);
      setGeoMessage("");
    }
  }

  function locateMe() {
    if (!("geolocation" in navigator)) {
      setGeoMessage("Your browser cannot share its location. Pick a place from the list instead.");
      return;
    }
    setLocating(true);
    setGeoMessage("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setLocation({
          id: "me",
          name: "your location",
          lat: Math.round(pos.coords.latitude * 1e6) / 1e6,
          lng: Math.round(pos.coords.longitude * 1e6) / 1e6,
        });
      },
      (err) => {
        setLocating(false);
        setGeoMessage(
          err.code === err.PERMISSION_DENIED
            ? "Location permission was denied. Pick a place from the list instead."
            : "Could not find your location. Pick a place from the list instead.",
        );
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  }

  function addToTrip(place) {
    const added = basket.addPlace(place);
    setAnnouncement(
      added
        ? `${place.name} added to your trip.`
        : basket.isFull
          ? "Your trip already has 10 stops."
          : `${place.name} is already in your trip.`,
    );
  }

  const detailPlace = places.find((p) => p.id === detailId) ?? null;

  return (
    <div className="container page discover">
      <header className="page-header">
        <span className="eyebrow">Food Discovery</span>
        <h1>Discover food near you</h1>
        <p>
          Search food places around a famous spot. Hidden Gems (well rated but not yet well known)
          are shown first.
        </p>
      </header>

      <div className="discover-layout">
        <div className="discover-side">
          <section className="card location-card" aria-labelledby="location-title">
            <h2 id="location-title" className="location-card__title">
              <MapPin size={18} aria-hidden="true" />
              Search near
            </h2>
            <div className="location-card__row">
              <div className="field" style={{ marginBottom: 0, flex: 1 }}>
                <label htmlFor="location-preset" className="visually-hidden">
                  Famous place
                </label>
                <select
                  id="location-preset"
                  className="select"
                  value={location.id === "me" ? "" : location.id}
                  onChange={(e) => choosePreset(e.target.value)}
                >
                  {location.id === "me" && <option value="">My location</option>}
                  {LOCATION_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <button type="button" className="btn btn-teal" onClick={locateMe} disabled={locating}>
                <Crosshair size={18} aria-hidden="true" />
                {locating ? "Locating…" : "Use my location"}
              </button>
            </div>
            {geoMessage && (
              <p className="field-error" role="alert" style={{ marginTop: "var(--space-sm)" }}>
                {geoMessage}
              </p>
            )}
            {usingPreferences && (
              <p className="field-hint" style={{ marginTop: "var(--space-sm)" }}>
                <Sparkles size={14} aria-hidden="true" style={{ display: "inline" }} /> Your saved
                preferences are used as starting filters.{" "}
                <Link to="/profile">Edit preferences</Link>
              </p>
            )}
          </section>

          <FilterPanel
            filters={filters}
            onChange={updateFilters}
            onReset={() => setFilters(initialFilters(NO_PREFERENCES))}
          />

          <div className="view-toggle segmented" role="group" aria-label="Show results as">
            <button
              type="button"
              className={`view-toggle__btn${view === "list" ? " is-active" : ""}`}
              aria-pressed={view === "list"}
              onClick={() => setView("list")}
            >
              <List size={18} aria-hidden="true" /> List
            </button>
            <button
              type="button"
              className={`view-toggle__btn${view === "map" ? " is-active" : ""}`}
              aria-pressed={view === "map"}
              onClick={() => setView("map")}
            >
              <MapIcon size={18} aria-hidden="true" /> Map
            </button>
          </div>

          <section
            className={`discover-results${view === "map" ? " is-hidden-mobile" : ""}`}
            aria-labelledby="results-title"
            aria-busy={result.status === "loading"}
          >
            <div className="discover-results__head">
              <h2 id="results-title" className="discover-results__title">
                Results
              </h2>
              {basket.places.length > 0 && (
                <Link to="/trip" className="btn btn-secondary btn-sm">
                  <Route size={16} aria-hidden="true" />
                  Trip ({basket.places.length})
                </Link>
              )}
            </div>

            <p className="muted small" aria-live="polite">
              {result.status === "ready" &&
                `${places.length} ${places.length === 1 ? "place" : "places"} ` +
                  `(${gemCount} Hidden ${gemCount === 1 ? "Gem" : "Gems"}) within ` +
                  `${formatDistance(filters.radius)} of ${location.name}.`}
              {result.status === "ready" &&
                ratedOnly &&
                hiddenUnrated > 0 &&
                ` ${hiddenUnrated} unrated places hidden.`}
            </p>

            <SampleDataBanner note={result.status === "ready" ? result.note : null} />

            {result.status === "loading" && (
              <LoadingSkeleton count={4} height={150} label="Searching food places" />
            )}
            {result.status === "error" && (
              <ErrorState
                title="Could not load food places"
                error={result.error}
                onRetry={() => setAttempt((a) => a + 1)}
              />
            )}
            {result.status === "ready" && places.length === 0 && (
              <EmptyState title="No places match these filters">
                <p>
                  Try a bigger radius, remove a filter
                  {ratedOnly && hiddenUnrated > 0 ? ", or switch off “Rated places only”" : ""}.
                </p>
              </EmptyState>
            )}
            {result.status === "ready" && places.length > 0 && (
              <ol className="place-list" aria-label="Food places">
                {places.map((place) => (
                  <li key={place.id}>
                    <PlaceCard
                      place={place}
                      selected={place.id === selectedId}
                      highlighted={place.id === hoveredId}
                      inTrip={basket.hasPlace(place.id)}
                      tripFull={basket.isFull}
                      onHover={setHoveredId}
                      onSelect={(id) => {
                        setSelectedId(id);
                        setDetailId(id);
                      }}
                      onAddToTrip={addToTrip}
                    />
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        <div className={`discover-map${view === "list" ? " is-hidden-mobile" : ""}`}>
          <PlaceMap
            places={result.status === "ready" ? places : []}
            centre={location}
            radius={filters.radius}
            selectedId={selectedId}
            hoveredId={hoveredId}
            onSelect={setSelectedId}
            onHover={setHoveredId}
            visible={view === "map"}
            label={`Map of food places near ${location.name}`}
          />
        </div>
      </div>

      <div className="visually-hidden" role="status" aria-live="polite">
        {announcement}
      </div>

      {detailId && (
        <PlaceDetailDrawer
          key={detailId}
          placeId={detailId}
          fallbackPlace={detailPlace}
          inTrip={basket.hasPlace(detailId)}
          tripFull={basket.isFull}
          onAddToTrip={addToTrip}
          onClose={() => setDetailId(null)}
        />
      )}
    </div>
  );
}
