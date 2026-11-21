// DEMO COPY of backend/src/modules/food-stalls-analytics/suggestion.js (ES module version).
// Used only by the GitHub Pages demo, which runs without the backend. Keep both in step.

// Food Place Suggestion (SRD 4.8.4, FR-FA-03, UC-10): a content-based recommender that
// LEARNS each user's taste from their trip history and suggests places near them.
// Pure functions (no database), so they are easy to unit test.
//
// 1. Strict preferences remove places that do not fit: halal only, maximum price level,
//    dietary needs. Places already in the user's trips and places further than 3 km from the
//    user are removed too (the aim is a new place nearby).
// 2. Taste profile (what is learned): every place is described by features
//      cuisine:<word>, area:<name>, price:<1-4>, hidden-gem
//    The profile gives each feature a weight: how often it appears among the stops of the
//    user's saved trips (6 of 7 stops Malay -> cuisine:malay 0.86), plus 1 for each favourite
//    cuisine set on the Profile page, plus a small prior for hidden gems (the analysis
//    finding the app is built around). The profile changes after every saved trip.
// 3. Score = 0.7 x similarity + 0.3 x nearness.
//      similarity = cosine similarity between the profile and the place's features (0 to 1)
//      nearness   = 1 - distance / 3 km (1 next to the user, 0 at 3 km)
//    The 5 highest scores are suggested. Places with similarity 0 are left out, so the page
//    can hide the section when nothing matches (UC-10 alternative flow 3a).
// No preferences and no trips: the best rated hidden gems nearby (findings only,
// UC-10 alternative flow 2a).

import { LABELS } from "./discovery.js";

const SUGGESTION_COUNT = 5;
const SUGGESTION_RADIUS_M = 3000;
const WEIGHTS = Object.freeze({ similarity: 0.7, nearness: 0.3 });
const PREFERENCE_WEIGHT = 1; // a favourite cuisine counts like a cuisine in every past stop
const HIDDEN_GEM_PRIOR = 0.5;
const BASED_ON = Object.freeze({ PREFERENCES: "preferences", FINDINGS: "findings" });

const lower = (text) =>
  String(text ?? "")
    .trim()
    .toLowerCase();

// "Chinese; noodle" -> ["chinese", "noodle"]
const cuisineWords = (cuisine) =>
  lower(cuisine)
    .split(/[;,/]/)
    .map((w) => w.trim())
    .filter(Boolean);

// Great-circle distance in metres.
function haversineMeters(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const a =
    Math.sin(toRad(lat2 - lat1) / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(toRad(lng2 - lng1) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(a));
}

// preferences: { halal?, maxPrice?, cuisine?: [], dietary?: [] } as validated by routes.js.
function hasPreferences(preferences = {}) {
  return (
    preferences.halal === true ||
    preferences.maxPrice != null ||
    (preferences.cuisine ?? []).length > 0 ||
    (preferences.dietary ?? []).length > 0
  );
}

// Step 1: true when the place breaks none of the strict preferences.
function fitsStrictPreferences(place, preferences = {}) {
  if (preferences.halal === true && place.isHalal !== true) return false;
  if (preferences.maxPrice != null && !(place.priceLevel <= preferences.maxPrice)) return false;
  const tags = place.dietary ?? [];
  return (preferences.dietary ?? []).every((tag) => tags.includes(tag));
}

// The features that describe one place.
function placeFeatures(place) {
  const features = cuisineWords(place.cuisine).map((w) => `cuisine:${w}`);
  if (place.area) features.push(`area:${lower(place.area)}`);
  if (place.priceLevel != null) features.push(`price:${place.priceLevel}`);
  if (place.label === LABELS.HIDDEN_GEM) features.push("hidden-gem");
  return [...new Set(features)];
}

// Step 2: learns the taste profile. pastPlaces: places from saved trips, with the same
// fields as a place (cuisine, area, priceLevel, label). Returns Map(feature -> weight).
function learnTasteProfile(preferences = {}, pastPlaces = []) {
  const profile = new Map();
  const add = (feature, weight) => profile.set(feature, (profile.get(feature) ?? 0) + weight);
  for (const place of pastPlaces) {
    for (const feature of placeFeatures(place)) add(feature, 1 / pastPlaces.length);
  }
  for (const cuisine of preferences.cuisine ?? []) {
    add(`cuisine:${lower(cuisine)}`, PREFERENCE_WEIGHT);
  }
  add("hidden-gem", HIDDEN_GEM_PRIOR);
  return profile;
}

// Cosine similarity between the profile and a place's features (each worth 1).
function cosineSimilarity(profile, features) {
  if (features.length === 0) return 0;
  let dot = 0;
  for (const f of features) dot += profile.get(f) ?? 0;
  let norm = 0;
  for (const w of profile.values()) norm += w * w;
  return norm > 0 ? dot / (Math.sqrt(norm) * Math.sqrt(features.length)) : 0;
}

// Readable reasons for a suggestion: the place's features the profile knows.
function matchReasons(profile, features) {
  const reasons = [];
  if (features.some((f) => f.startsWith("cuisine:") && profile.has(f))) reasons.push("cuisine");
  if (features.some((f) => f.startsWith("price:") && profile.has(f))) reasons.push("price");
  if (features.some((f) => f.startsWith("area:") && profile.has(f))) reasons.push("area");
  if (features.includes("hidden-gem")) reasons.push("hidden gem");
  return reasons;
}

const round3 = (x) => Math.round(x * 1000) / 1000;

// Best rating first; with equal rating, fewer reviews (less known) first; then name.
const byRating = (a, b) =>
  b.avgRating - a.avgRating ||
  a.reviewCount - b.reviewCount ||
  String(a.name ?? "").localeCompare(String(b.name ?? ""));

// places: analysed places (see toAnalysedPlace in service.js).
// options: { preferences, pastPlaces, location: { lat, lng } | null, count, radiusM }.
// Returns { basedOn, suggestions: [place + { matchScore, similarity, distanceM, matchedOn }] }.
// The input is not reordered.
function suggestFoodPlaces(
  places,
  {
    preferences = {},
    pastPlaces = [],
    location = null,
    count = SUGGESTION_COUNT,
    radiusM = SUGGESTION_RADIUS_M,
  } = {},
) {
  const visited = new Set(pastPlaces.map((p) => p.id).filter(Boolean));
  const nearby = places
    .filter((p) => !visited.has(p.id))
    .map((p) => {
      const distanceM =
        location && p.lat != null && p.lng != null
          ? Math.round(haversineMeters(location.lat, location.lng, Number(p.lat), Number(p.lng)))
          : null;
      return { place: p, distanceM };
    })
    .filter(({ distanceM }) => distanceM === null || distanceM <= radiusM);
  const nearness = (distanceM) => (distanceM === null ? 0 : 1 - distanceM / radiusM);

  if (!hasPreferences(preferences) && pastPlaces.length === 0) {
    const suggestions = nearby
      .filter(({ place }) => place.label === LABELS.HIDDEN_GEM)
      .sort((a, b) => byRating(a.place, b.place))
      .slice(0, count)
      .map(({ place, distanceM }) => ({
        ...place,
        matchScore: null,
        similarity: null,
        distanceM,
        matchedOn: ["hidden gem"],
      }));
    return { basedOn: BASED_ON.FINDINGS, suggestions };
  }

  const profile = learnTasteProfile(preferences, pastPlaces);
  const weightNear = location ? WEIGHTS.nearness : 0;
  const weightSimilar = location ? WEIGHTS.similarity : 1;
  const suggestions = nearby
    .filter(({ place }) => fitsStrictPreferences(place, preferences))
    .map(({ place, distanceM }) => {
      const features = placeFeatures(place);
      const similarity = cosineSimilarity(profile, features);
      const score = weightSimilar * similarity + weightNear * nearness(distanceM);
      return {
        ...place,
        matchScore: round3(score),
        similarity: round3(similarity),
        distanceM,
        matchedOn: matchReasons(profile, features),
      };
    })
    .filter((p) => p.similarity > 0)
    .sort((a, b) => b.matchScore - a.matchScore || byRating(a, b))
    .slice(0, count);
  return { basedOn: BASED_ON.PREFERENCES, suggestions };
}

export {
  suggestFoodPlaces,
  learnTasteProfile,
  cosineSimilarity,
  placeFeatures,
  fitsStrictPreferences,
  hasPreferences,
  haversineMeters,
  SUGGESTION_COUNT,
  SUGGESTION_RADIUS_M,
  WEIGHTS,
  BASED_ON,
};
