// Food Stalls Analytics API: Food Places Visualisation, Analysis and Suggestion.

import { apiRequest } from "./client";
import { getPreferences } from "./userManagement";
import { listPastPlaceIds } from "./foodHopping";

// Food Place Suggestion needs the user's preferences (Profile page) and past choices (the
// places in saved trips). Both are kept on this device until Phase 2B, so they are sent
// with the request: { halal, maxPrice, cuisine, dietary, pastPlaceIds }.
export async function suggestionQuery(preferences = getPreferences()) {
  return {
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

// "Suggested for you" on the Discover page. Returns
// { basedOn: "preferences" | "findings", suggestions, thresholds, note? }.
export async function getFoodPlaceSuggestions({ signal } = {}) {
  const query = await suggestionQuery();
  return apiRequest("/api/analytics/suggestions", { query, signal });
}
