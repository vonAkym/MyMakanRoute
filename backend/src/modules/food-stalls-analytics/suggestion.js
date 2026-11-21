// Food Place Suggestion (SRD 4.8.4, FR-FA-03, UC-10): content-based filtering.
// Pure functions (no database), so they are easy to unit test.
//
// 1. Strict preferences remove places that do not fit: halal only, maximum price level and
//    dietary needs.
// 2. Each remaining place gets a match score: one point for each feature that matches the
//    user's preferences and past choices (places in the user's saved trips):
//      cuisine    - one of the user's favourite cuisines, or a cuisine they chose before
//      price      - a price level they chose before (no trips yet: within their budget)
//      area       - an area they chose before
//      hidden gem - the analysis finding "highly rated with few reviews"
// 3. The highest scores are suggested (up to 5). Places with score 0 are left out, so the
//    page can hide the section when nothing matches (UC-10 alternative flow 3a). Places
//    already in the user's trips are left out too: the aim is a new place to visit.
// No preferences and no past choices: suggestions come from the findings only, which are
// the best rated hidden gems (UC-10 alternative flow 2a).

const { LABELS } = require("../food-discovery/hiddenGem");

const SUGGESTION_COUNT = 5;
const BASED_ON = Object.freeze({ PREFERENCES: "preferences", FINDINGS: "findings" });

const lower = (text) =>
  String(text ?? "")
    .trim()
    .toLowerCase();

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

// Step 2: which features match. pastPlaces: [{ id, area, cuisine, priceLevel }].
function matchFeatures(place, preferences = {}, pastPlaces = []) {
  const cuisine = lower(place.cuisine);
  const likedCuisines = [
    ...(preferences.cuisine ?? []),
    ...pastPlaces.map((p) => lower(p.cuisine)),
  ];
  const pastPrices = pastPlaces.map((p) => p.priceLevel).filter((x) => x != null);
  const pastAreas = pastPlaces.map((p) => lower(p.area)).filter(Boolean);

  const matched = [];
  // "chinese" matches "chinese;noodle", like the cuisine filter in Food Discovery.
  if (cuisine && likedCuisines.some((c) => c && cuisine.includes(c))) matched.push("cuisine");
  const priceMatches =
    pastPrices.length > 0
      ? pastPrices.includes(place.priceLevel)
      : preferences.maxPrice != null && place.priceLevel <= preferences.maxPrice;
  if (priceMatches) matched.push("price");
  if (place.area && pastAreas.includes(lower(place.area))) matched.push("area");
  if (place.label === LABELS.HIDDEN_GEM) matched.push("hidden gem");
  return matched;
}

// Best rating first; with equal rating, fewer reviews (less known) first; then name.
const byRating = (a, b) =>
  b.avgRating - a.avgRating ||
  a.reviewCount - b.reviewCount ||
  String(a.name ?? "").localeCompare(String(b.name ?? ""));

// places: analysed places (see toAnalysedPlace in service.js). Returns
// { basedOn, suggestions: [place + { matchScore, matchedOn }] }. The input is not reordered.
function suggestFoodPlaces(
  places,
  { preferences = {}, pastPlaces = [], count = SUGGESTION_COUNT } = {},
) {
  if (!hasPreferences(preferences) && pastPlaces.length === 0) {
    const suggestions = places
      .filter((p) => p.label === LABELS.HIDDEN_GEM)
      .sort(byRating)
      .slice(0, count)
      .map((p) => ({ ...p, matchScore: 1, matchedOn: ["hidden gem"] }));
    return { basedOn: BASED_ON.FINDINGS, suggestions };
  }

  const visited = new Set(pastPlaces.map((p) => p.id));
  const suggestions = places
    .filter((p) => !visited.has(p.id) && fitsStrictPreferences(p, preferences))
    .map((p) => {
      const matchedOn = matchFeatures(p, preferences, pastPlaces);
      return { ...p, matchScore: matchedOn.length, matchedOn };
    })
    .filter((p) => p.matchScore > 0)
    .sort((a, b) => b.matchScore - a.matchScore || byRating(a, b))
    .slice(0, count);
  return { basedOn: BASED_ON.PREFERENCES, suggestions };
}

module.exports = {
  suggestFoodPlaces,
  fitsStrictPreferences,
  matchFeatures,
  hasPreferences,
  SUGGESTION_COUNT,
  BASED_ON,
};
