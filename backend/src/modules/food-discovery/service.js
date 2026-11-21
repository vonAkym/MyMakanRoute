// Food Place Searching + Hidden Gem Highlighting: the logic between the controller and the SQL.

const config = require("../../config");
const { AppError } = require("../../lib/response");
const model = require("./model");
const { LABELS, labelHiddenGem, rankFoodPlaces } = require("./hiddenGem");
const { isOpenAt } = require("./openingHours");

const SAMPLE_NOTE = "Ratings for sample places are invented for testing.";

// Query value of ?label= -> label text.
const LABEL_FILTERS = { hidden_gem: LABELS.HIDDEN_GEM, popular: LABELS.POPULAR };

// Database row (snake_case) -> API shape (camelCase) with the label attached.
function toFoodPlace(row, thresholds) {
  const place = {
    id: row.id,
    name: row.name,
    cuisine: row.cuisine,
    area: row.area,
    address: row.address,
    isHalal: row.is_halal,
    priceLevel: row.price_level,
    avgRating: row.avg_rating == null ? null : Number(row.avg_rating),
    reviewCount: row.review_count,
    dietary: row.dietary ?? [],
    openingHours: row.opening_hours,
    isSample: row.is_sample === true,
    lat: row.lat,
    lng: row.lng,
    label: labelHiddenGem(row, thresholds),
  };
  if (row.distance_m != null) place.distanceM = Math.round(Number(row.distance_m));
  return place;
}

// Adds the sample-data warning when any place in the answer is SAMPLE data.
function withSampleNote(data, places) {
  return places.some((p) => p.isSample) ? { ...data, note: SAMPLE_NOTE } : data;
}

// filters: validated query (lat, lng, radius, halal, maxPrice, cuisine[], dietary[],
// openNow, label, limit). options.now lets tests fix the clock for openNow.
async function searchFoodPlaces(filters, options = {}) {
  const now = options.now ?? new Date();
  const thresholds = config.hiddenGem;

  const rows = await model.findFoodPlacesNearby({
    lat: filters.lat,
    lng: filters.lng,
    radius: filters.radius,
    halal: filters.halal,
    maxPrice: filters.maxPrice,
    cuisines: filters.cuisine,
    dietary: filters.dietary,
  });

  let places = rows.map((row) => toFoodPlace(row, thresholds));

  // openNow and label are filtered here in JavaScript, not in SQL: opening hours are
  // JSON that is easier to check in code (time zone, past-midnight ranges), and the label
  // rule lives in hiddenGem.js. A 5 km radius in Penang holds at most a few thousand
  // places, so this is cheap.
  if (filters.openNow === true) {
    places = places.filter((p) => isOpenAt(p.openingHours, now));
  }
  if (filters.label) {
    places = places.filter((p) => p.label === LABEL_FILTERS[filters.label]);
  }

  // Rank first, then cut to the limit, so the best places are the ones kept.
  places = rankFoodPlaces(places).slice(0, filters.limit);

  return withSampleNote({ count: places.length, places, thresholds }, places);
}

async function getFoodPlace(id) {
  const row = await model.findFoodPlaceById(id);
  if (!row) throw new AppError(404, "NOT_FOUND", "Food place not found");
  const place = toFoodPlace(row, config.hiddenGem);
  return withSampleNote({ place, thresholds: config.hiddenGem }, [place]);
}

module.exports = { searchFoodPlaces, getFoodPlace, toFoodPlace, SAMPLE_NOTE };
