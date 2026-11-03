// Food Stalls Analytics API: Food Places Visualisation, Analysis and Suggestion.

import { apiRequest } from "./client";

// Returns { totals, labels, labelAverages, byArea, byCuisine, points, suggestions,
//           findings, thresholds, note? }.
export function getAnalyticsOverview({ signal } = {}) {
  return apiRequest("/api/analytics/overview", { signal });
}
