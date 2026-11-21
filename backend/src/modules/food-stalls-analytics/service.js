// Food Stalls Analytics: builds the dashboard overview.
//   Food Places Visualisation -> totals, by area, by cuisine, label counts, scatter points
//   Food Places Analysis      -> findings sentences (findings.js)
//   Food Place Suggestion     -> recommender that learns the user's taste from trip history
//                                and suggests places nearby (suggestion.js, SRD 4.8.4)

const config = require("../../config");
const model = require("./model");
const { LABELS, labelHiddenGem } = require("../food-discovery/hiddenGem");
const { SAMPLE_NOTE } = require("../food-discovery/service");
const { analyseFoodPlaces } = require("./findings");
const { suggestFoodPlaces, SUGGESTION_RADIUS_M } = require("./suggestion");

const NO_LABEL = "No label";

const round2 = (x) => (x == null ? null : Math.round(Number(x) * 100) / 100);

// Group row from SQL -> API shape.
const toGroup = (row) => ({
  name: row.name,
  places: row.places,
  averageRating: round2(row.average_rating),
});

// Database row -> one analysed place (camelCase, with its label).
function toAnalysedPlace(row, thresholds) {
  return {
    id: row.id,
    name: row.name,
    area: row.area,
    cuisine: row.cuisine,
    isHalal: row.is_halal,
    priceLevel: row.price_level,
    dietary: row.dietary ?? [],
    avgRating: Number(row.avg_rating),
    reviewCount: row.review_count,
    isSample: row.is_sample === true,
    lat: row.lat,
    lng: row.lng,
    label: labelHiddenGem(row, thresholds),
  };
}

// Average rating and reviews of a group of places, or null when the group is empty.
function averagesFor(places) {
  if (places.length === 0) return null;
  const sum = (key) => places.reduce((s, p) => s + p[key], 0);
  return {
    places: places.length,
    averageRating: round2(sum("avgRating") / places.length),
    averageReviews: Math.round(sum("reviewCount") / places.length),
  };
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Past choices: the places in the user's saved trips (sent by the app as pastPlaceIds,
// because trips are kept on the device until the itinerary API arrives in Phase 2B).
// Ids that are not UUIDs are ignored, so they never reach the SQL query.
async function loadPastPlaces(pastPlaceIds = []) {
  const ids = [...new Set(pastPlaceIds)].filter((id) => UUID_PATTERN.test(id));
  if (ids.length === 0) return [];
  const rows = await model.findPlaceFeatures(ids);
  return rows.map((row) => ({
    id: row.id,
    area: row.area,
    cuisine: row.cuisine,
    priceLevel: row.price_level,
    label: labelHiddenGem(row, config.hiddenGem),
  }));
}

// Where the user is, when the app sent it.
const locationFrom = ({ lat, lng } = {}) =>
  lat !== undefined && lng !== undefined ? { lat, lng } : null;

// query (validated in routes.js): { lat?, lng?, halal?, maxPrice?, cuisine?, dietary?,
//                                   pastPlaceIds? }
const preferencesFrom = ({ halal, maxPrice, cuisine, dietary } = {}) => ({
  halal,
  maxPrice,
  cuisine,
  dietary,
});

// GET /api/analytics/suggestions: the "Suggested for you" cards on the Discover page.
async function getFoodPlaceSuggestions(query = {}) {
  const thresholds = config.hiddenGem;
  const [placeRows, pastPlaces] = await Promise.all([
    model.findRatedFoodPlaces(),
    loadPastPlaces(query.pastPlaceIds),
  ]);
  const places = placeRows.map((row) => toAnalysedPlace(row, thresholds));
  const { basedOn, suggestions } = suggestFoodPlaces(places, {
    preferences: preferencesFrom(query),
    pastPlaces,
    location: locationFrom(query),
  });
  const result = { basedOn, suggestions, thresholds, radiusM: SUGGESTION_RADIUS_M };
  return suggestions.some((p) => p.isSample) ? { ...result, note: SAMPLE_NOTE } : result;
}

async function getAnalyticsOverview(query = {}) {
  const thresholds = config.hiddenGem;
  const [summary, areaRows, cuisineRows, placeRows, pastPlaces] = await Promise.all([
    model.summariseRatedFoodPlaces(),
    model.averageRatingBy("area"),
    model.averageRatingBy("cuisine"),
    model.findRatedFoodPlaces(),
    loadPastPlaces(query.pastPlaceIds),
  ]);

  const places = placeRows.map((row) => toAnalysedPlace(row, thresholds));
  const hiddenGems = places.filter((p) => p.label === LABELS.HIDDEN_GEM);
  const popular = places.filter((p) => p.label === LABELS.POPULAR);
  const ratedPlaces = summary.rated_places;

  const totals = {
    ratedPlaces,
    hiddenGems: hiddenGems.length,
    popular: popular.length,
    unlabelled: places.length - hiddenGems.length - popular.length,
    averageRating: round2(summary.average_rating),
    halalPlaces: summary.halal_places,
    halalShare: ratedPlaces > 0 ? round2(summary.halal_places / ratedPlaces) : 0,
    samplePlaces: summary.sample_places,
  };
  const byArea = areaRows.map(toGroup);
  const byCuisine = cuisineRows.map(toGroup);
  const labelAverages = { hiddenGem: averagesFor(hiddenGems), popular: averagesFor(popular) };
  const { basedOn, suggestions } = suggestFoodPlaces(places, {
    preferences: preferencesFrom(query),
    pastPlaces,
    location: locationFrom(query),
  });

  const overview = {
    totals,
    labels: [
      { label: LABELS.HIDDEN_GEM, count: totals.hiddenGems },
      { label: LABELS.POPULAR, count: totals.popular },
      { label: NO_LABEL, count: totals.unlabelled },
    ],
    labelAverages,
    byArea,
    byCuisine,
    points: places.map(({ id, name, avgRating, reviewCount, label }) => ({
      id,
      name,
      avgRating,
      reviewCount,
      label,
    })),
    suggestions,
    suggestionsBasedOn: basedOn,
    findings: analyseFoodPlaces({ totals, byArea, byCuisine, labelAverages, thresholds }),
    thresholds,
  };
  return totals.samplePlaces > 0 ? { ...overview, note: SAMPLE_NOTE } : overview;
}

module.exports = { getAnalyticsOverview, getFoodPlaceSuggestions, toAnalysedPlace, loadPastPlaces };
