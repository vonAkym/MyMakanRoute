// Food Stalls Analytics: builds the dashboard overview.
//   Food Places Visualisation -> totals, by area, by cuisine, label counts, scatter points
//   Food Places Analysis      -> findings sentences (findings.js)
//   Food Place Suggestion     -> top hidden gems (suggestFoodPlaces)

const config = require("../../config");
const model = require("./model");
const { LABELS, labelHiddenGem } = require("../food-discovery/hiddenGem");
const { SAMPLE_NOTE } = require("../food-discovery/service");
const { analyseFoodPlaces } = require("./findings");

const SUGGESTION_COUNT = 5;
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

// Food Place Suggestion: best rated hidden gems first; with equal rating, the one with
// fewer reviews (less known) comes first.
function suggestFoodPlaces(places, count = SUGGESTION_COUNT) {
  return places
    .filter((p) => p.label === LABELS.HIDDEN_GEM)
    .sort((a, b) => b.avgRating - a.avgRating || a.reviewCount - b.reviewCount)
    .slice(0, count);
}

async function getAnalyticsOverview() {
  const thresholds = config.hiddenGem;
  const [summary, areaRows, cuisineRows, placeRows] = await Promise.all([
    model.summariseRatedFoodPlaces(),
    model.averageRatingBy("area"),
    model.averageRatingBy("cuisine"),
    model.findRatedFoodPlaces(),
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
    suggestions: suggestFoodPlaces(places),
    findings: analyseFoodPlaces({ totals, byArea, byCuisine, labelAverages, thresholds }),
    thresholds,
  };
  return totals.samplePlaces > 0 ? { ...overview, note: SAMPLE_NOTE } : overview;
}

module.exports = { getAnalyticsOverview, suggestFoodPlaces, toAnalysedPlace };
