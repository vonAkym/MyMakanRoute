// Food Stalls Analytics API: Food Places Visualisation, Analysis and Suggestion.

import { apiRequest } from "./client";
import { getPreferences } from "./userManagement";
import { listPastPlaceIds } from "./foodHopping";
import { readJson, writeJson, STORAGE_KEYS } from "../lib/storage";
import { LOCATION_PRESETS } from "../lib/constants";

// Where the user is for "near you" suggestions: the last place chosen on Discover
// (a preset or "your location"), Komtar by default.
export function getSuggestionLocation() {
  const saved = readJson(STORAGE_KEYS.lastLocation, null);
  const valid =
    saved &&
    Number.isFinite(saved.lat) &&
    Number.isFinite(saved.lng) &&
    typeof saved.name === "string";
  return valid ? saved : LOCATION_PRESETS[0];
}

export function rememberSuggestionLocation({ name, lat, lng }) {
  writeJson(STORAGE_KEYS.lastLocation, { name, lat, lng });
}

// Food Place Suggestion needs the user's location, preferences (Profile page) and past
// choices (the places in saved trips, from which it learns the user's taste). They are kept
// on this device until Phase 2B, so they are sent with the request:
// { lat, lng, halal, maxPrice, cuisine, dietary, pastPlaceIds }.
export async function suggestionQuery(
  location = getSuggestionLocation(),
  preferences = getPreferences(),
) {
  return {
    lat: location?.lat,
    lng: location?.lng,
    halal: preferences.halalOnly ? true : undefined,
    maxPrice: preferences.maxBudget ?? undefined,
    cuisine: preferences.cuisines,
    dietary: preferences.dietary,
    pastPlaceIds: await listPastPlaceIds(),
  };
}

// Returns { totals, labels, labelAverages, byArea, byCuisine, points, suggestions,
//           suggestionsBasedOn, findings, thresholds, note? }.
export async function getAnalyticsOverview({ signal } = {}) {
  const query = await suggestionQuery();
  return apiRequest("/api/analytics/overview", { query, signal });
}

// "Suggested for you" on the Discover page, near `location` ({ lat, lng }). Returns
// { basedOn: "preferences" | "findings", suggestions, radiusM, thresholds, note? }.
export async function getFoodPlaceSuggestions({ signal, location } = {}) {
  const query = await suggestionQuery(location);
  return apiRequest("/api/analytics/suggestions", { query, signal });
}
