// Food Discovery API: Food Place Searching + Hidden Gem Highlighting.

import { apiRequest } from "./client";

// filters: { lat, lng, radius, halal, maxPrice, cuisine: string[], dietary: string[],
//            openNow, label: "hidden_gem" | "popular" | "", limit }
// Returns { count, places, thresholds, note? }.
export function searchFoodPlaces(filters, { signal } = {}) {
  const query = {
    lat: filters.lat,
    lng: filters.lng,
    radius: filters.radius,
    // Only send true; "false" would mean the same as not filtering.
    halal: filters.halal ? "true" : undefined,
    maxPrice: filters.maxPrice || undefined,
    cuisine: filters.cuisine,
    dietary: filters.dietary,
    openNow: filters.openNow ? "true" : undefined,
    label: filters.label || undefined,
    limit: filters.limit ?? 100,
  };
  return apiRequest("/api/discovery/places", { query, signal });
}

// Returns { place, thresholds, note? }.
export function getFoodPlace(id, { signal } = {}) {
  return apiRequest(`/api/discovery/places/${encodeURIComponent(id)}`, { signal });
}
