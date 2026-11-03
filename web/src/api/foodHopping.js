// Food Hopping API: Route Planner (POST /api/hopping/route).
// The backend response is mapped to the web app's shape HERE ONLY, so a change in the
// backend field names needs a change in this one file.

import { apiRequest } from "./client";
import { readJson, writeJson, STORAGE_KEYS } from "../lib/storage";

// Backend place (snake_case from the route model) -> web place (camelCase).
function toStop(place) {
  return {
    id: place.id,
    name: place.name,
    lat: Number(place.lat),
    lng: Number(place.lng),
    cuisine: place.cuisine ?? null,
    avgRating: place.avg_rating ?? place.avgRating ?? null,
    reviewCount: place.review_count ?? place.reviewCount ?? null,
    isSample: (place.is_sample ?? place.isSample) === true,
  };
}

// One algorithm result: { order: [placeId], totalTimeS, runtimeMs } or null.
function toResult(result) {
  if (!result) return null;
  return {
    order: result.order,
    totalTimeS: result.totalTimeS,
    runtimeMs: result.runtimeMs ?? null,
  };
}

// Backend route -> { travelMode, stops, legs, totalTimeS, totalDistanceM, comparison,
//                    algorithm, graph }
export function toPlannedRoute(data) {
  return {
    travelMode: data.travelMode,
    stops: (data.order ?? []).map(toStop),
    legs: (data.legs ?? []).map((leg) => ({
      fromId: leg.fromPlaceId ?? leg.from,
      toId: leg.toPlaceId ?? leg.to,
      timeS: leg.timeS ?? leg.time_s,
      distanceM: leg.distanceM ?? leg.distance_m,
      // [[lat, lng], ...] for the map polyline
      path: leg.path ?? [],
    })),
    totalTimeS: data.totalTimeS,
    totalDistanceM: data.totalDistanceM,
    comparison: {
      aco: toResult(data.comparison?.aco),
      nearestNeighbour: toResult(data.comparison?.nearestNeighbour),
      bruteForce: toResult(data.comparison?.bruteForce),
    },
    algorithm: data.algorithm ?? null,
    graph: data.graph ?? null,
  };
}

// placeIds: 2 to 10 ids; travelMode: "walking" | "driving"; startPlaceId optional.
export async function planRoute({ placeIds, travelMode = "walking", startPlaceId, seed }) {
  const body = { placeIds, travelMode };
  if (startPlaceId) body.startPlaceId = startPlaceId;
  if (seed !== undefined) body.seed = seed;
  const data = await apiRequest("/api/hopping/route", { method: "POST", body });
  return toPlannedRoute(data);
}

// ---------------------------------------------------------------------------
// Itinerary save + Past Food Hopping Visualisation.
// SAVED ON THIS DEVICE ONLY (localStorage) until the itinerary API arrives in Phase 2B
// (PLAN steps 2.12 to 2.14). Same function names will then call the backend.

const MAX_SAVED_TRIPS = 50;

export async function listSavedTrips() {
  const trips = readJson(STORAGE_KEYS.savedTrips, []);
  // Drop entries that are not saved trips (wrong shape from hand edits or older versions).
  return Array.isArray(trips)
    ? trips.filter((t) => t && typeof t.id === "string" && Array.isArray(t.route?.stops))
    : [];
}

export async function getSavedTrip(id) {
  const trips = await listSavedTrips();
  return trips.find((t) => t.id === id) ?? null;
}

// trip: { name, route } where route is a planned route from planRoute().
export async function saveTrip({ name, route }) {
  const trips = await listSavedTrips();
  const trip = {
    id: `trip-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    name: String(name || "My food hop").slice(0, 80),
    savedAt: new Date().toISOString(),
    route,
  };
  writeJson(STORAGE_KEYS.savedTrips, [trip, ...trips].slice(0, MAX_SAVED_TRIPS));
  return trip;
}

export async function deleteSavedTrip(id) {
  const trips = await listSavedTrips();
  writeJson(
    STORAGE_KEYS.savedTrips,
    trips.filter((t) => t.id !== id),
  );
}
