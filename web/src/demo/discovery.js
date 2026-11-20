// DEMO COPY of the Food Discovery logic (backend/src/modules/food-discovery/hiddenGem.js,
// openingHours.js and service.js), as ES modules. Used only by the GitHub Pages demo, which
// runs without the backend. Keep both in step.

import { DEMO_PLACES, DEMO_THRESHOLDS, DEMO_NOTE, haversineMeters } from "./places.js";

export const LABELS = Object.freeze({ HIDDEN_GEM: "Hidden Gem", POPULAR: "Popular" });
const LABEL_FILTERS = { hidden_gem: LABELS.HIDDEN_GEM, popular: LABELS.POPULAR };

function toNumberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// Hidden Gem Highlighting: same rule as labelHiddenGem() in the backend.
export function labelHiddenGem(place, thresholds = DEMO_THRESHOLDS) {
  const rating = toNumberOrNull(place.avg_rating ?? place.avgRating);
  const reviews = toNumberOrNull(place.review_count ?? place.reviewCount) ?? 0;
  if (rating === null || reviews < 1) return null;
  if (rating >= thresholds.minRating && reviews <= thresholds.maxReviews) {
    return LABELS.HIDDEN_GEM;
  }
  if (reviews > thresholds.popularMinReviews) return LABELS.POPULAR;
  return null;
}

// Hidden Gems first, then Popular, then no label; nearest first; higher rating breaks ties.
export function rankFoodPlaces(places) {
  const order = { [LABELS.HIDDEN_GEM]: 0, [LABELS.POPULAR]: 1 };
  const group = (p) => order[p.label] ?? 2;
  const distance = (p) => toNumberOrNull(p.distanceM) ?? Infinity;
  const rating = (p) => toNumberOrNull(p.avgRating) ?? -1;
  return [...places].sort(
    (a, b) => group(a) - group(b) || distance(a) - distance(b) || rating(b) - rating(a),
  );
}

// ---- Opening hours ("open now"), in Malaysian time --------------------------------------

const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

function toMinutes(text) {
  const match = TIME_PATTERN.exec(text);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function localDayAndMinutes(date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kuala_Lumpur",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type).value;
  return {
    day: get("weekday").toLowerCase().slice(0, 3),
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

function rangesFor(openingHours, day) {
  const ranges = Array.isArray(openingHours[day]) ? openingHours[day] : [];
  const out = [];
  for (const range of ranges) {
    if (!Array.isArray(range) || range.length !== 2) continue;
    const start = toMinutes(range[0]);
    let end = toMinutes(range[1]);
    if (start === null || end === null) continue;
    if (end === 23 * 60 + 59) end = 24 * 60; // "23:59" means until midnight
    out.push([start, end]);
  }
  return out;
}

// Places without day-by-day hours count as NOT open, as in the backend.
export function isOpenAt(openingHours, date = new Date()) {
  if (!openingHours || !DAYS.some((d) => Array.isArray(openingHours[d]))) return false;
  const { day, minutes } = localDayAndMinutes(date);
  const yesterday = DAYS[(DAYS.indexOf(day) + 6) % 7];
  for (const [start, end] of rangesFor(openingHours, day)) {
    if (start < end && minutes >= start && minutes < end) return true;
    if (start > end && minutes >= start) return true; // e.g. 18:00-02:00, before midnight
  }
  for (const [start, end] of rangesFor(openingHours, yesterday)) {
    if (start > end && minutes < end) return true; // yesterday's late range, after midnight
  }
  return false;
}

// ---- Food Place Searching -----------------------------------------------------------------

// Database row -> API shape, same as toFoodPlace() in the backend.
export function toFoodPlace(row, distanceM) {
  const place = {
    id: row.id,
    name: row.name,
    cuisine: row.cuisine,
    area: row.area,
    address: row.address,
    isHalal: row.is_halal,
    priceLevel: row.price_level,
    avgRating: row.avg_rating,
    reviewCount: row.review_count,
    dietary: row.dietary ?? [],
    openingHours: row.opening_hours,
    isSample: row.is_sample === true,
    lat: row.lat,
    lng: row.lng,
    label: labelHiddenGem(row),
  };
  if (distanceM != null) place.distanceM = Math.round(distanceM);
  return place;
}

const asList = (value) =>
  (Array.isArray(value) ? value : String(value ?? "").split(","))
    .map((s) => String(s).trim().toLowerCase())
    .filter(Boolean);

const isTrue = (value) => value === true || value === "true";

// query: the same values the web app sends to GET /api/discovery/places.
export function searchFoodPlaces(query = {}, now = new Date()) {
  const lat = Number(query.lat);
  const lng = Number(query.lng);
  const radius = Number(query.radius) || 1500;
  const maxPrice = query.maxPrice ? Number(query.maxPrice) : null;
  const cuisines = asList(query.cuisine);
  const dietary = asList(query.dietary);
  const limit = Number(query.limit) || 50;

  let places = DEMO_PLACES.map((row) => ({
    row,
    d: haversineMeters(lat, lng, row.lat, row.lng),
  }))
    .filter(({ d }) => d <= radius)
    .filter(({ row }) => !isTrue(query.halal) || row.is_halal === true)
    .filter(({ row }) => maxPrice === null || row.price_level <= maxPrice)
    .filter(
      ({ row }) =>
        cuisines.length === 0 || cuisines.some((c) => row.cuisine.toLowerCase().includes(c)),
    )
    .filter(({ row }) => dietary.every((tag) => row.dietary.includes(tag)))
    .map(({ row, d }) => toFoodPlace(row, d));

  if (isTrue(query.openNow)) places = places.filter((p) => isOpenAt(p.openingHours, now));
  if (query.label) places = places.filter((p) => p.label === LABEL_FILTERS[query.label]);

  places = rankFoodPlaces(places).slice(0, limit);
  return { count: places.length, places, thresholds: DEMO_THRESHOLDS, note: DEMO_NOTE };
}

// Food Place Visualisation: one place by id, or null.
export function getFoodPlace(id) {
  const row = DEMO_PLACES.find((p) => p.id === id);
  return row ? { place: toFoodPlace(row), thresholds: DEMO_THRESHOLDS, note: DEMO_NOTE } : null;
}
