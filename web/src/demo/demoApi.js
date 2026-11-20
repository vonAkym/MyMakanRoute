// DEMO MODE: answers the web app's API calls inside the browser, with the 55 sample places,
// so the GitHub Pages version works without the backend server.
// It is switched on only in the Pages build (see isDemoMode() in api/client.js).
// It answers the same four endpoints as the backend, with the same data shapes.

import { ApiError } from "../api/client.js";
import { searchFoodPlaces, getFoodPlace } from "./discovery.js";
import { planRoute } from "./routePlanner.js";
import { getAnalyticsOverview } from "./analytics.js";

const PLACE_PATH = /^\/api\/discovery\/places\/([^/]+)$/;

// path: "/api/..."; returns the same `data` the backend would send, or throws ApiError.
export async function demoRequest(path, { method = "GET", body, query } = {}) {
  if (method === "GET" && path === "/api/discovery/places") {
    if (query?.lat == null || query?.lng == null) {
      throw new ApiError("lat and lng are required", { code: "VALIDATION_ERROR", status: 400 });
    }
    return searchFoodPlaces(query);
  }

  const placeMatch = PLACE_PATH.exec(path);
  if (method === "GET" && placeMatch) {
    const result = getFoodPlace(decodeURIComponent(placeMatch[1]));
    if (!result) throw new ApiError("Food place not found", { code: "NOT_FOUND", status: 404 });
    return result;
  }

  if (method === "POST" && path === "/api/hopping/route") return planRoute(body);

  if (method === "GET" && path === "/api/analytics/overview") return getAnalyticsOverview();

  throw new ApiError("This feature is not available in the demo version.", {
    code: "NOT_FOUND",
    status: 404,
  });
}
