// DEMO DATA: the 55 sample places from backend/db/seeds/sample-places.json, turned into the
// same row shape the backend reads from the database.
// Names and coordinates are real (OpenStreetMap); ratings, review counts, prices, halal flags
// and opening hours are INVENTED for testing.

import seed from "./sample-places.json";

// "way/976552716" -> "way-976552716". The database uses UUIDs; the demo uses the OSM id
// so every place keeps the same id on every visit.
export const toDemoId = (osmId) => osmId.replace("/", "-");

export const DEMO_PLACES = Object.freeze(
  seed.places.map((p) => ({
    id: toDemoId(p.osm_id),
    name: p.name,
    cuisine: p.cuisine,
    area: p.area,
    address: null,
    is_halal: p.is_halal,
    price_level: p.price_level,
    avg_rating: p.avg_rating,
    review_count: p.review_count,
    dietary: p.dietary,
    opening_hours: p.opening_hours,
    is_sample: true,
    lat: p.lat,
    lng: p.lng,
  })),
);

// Same hidden gem thresholds as the backend defaults (backend/src/config/loadConfig.js).
export const DEMO_THRESHOLDS = Object.freeze({
  minRating: 4.3,
  maxReviews: 100,
  popularMinReviews: 100,
});

export const DEMO_NOTE =
  "Demo version: runs in your browser with 55 sample places. Ratings are invented for testing, " +
  "and travel times are estimates (straight line x 1.3), not real roads.";

const EARTH_RADIUS_M = 6371000;

// Great-circle ("as the crow flies") distance between two points, in metres.
export function haversineMeters(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}
