// DEMO COPY of the Food Stalls Analytics logic (backend/src/modules/food-stalls-analytics/
// service.js, model.js and findings.js), as an ES module. The SQL "group by" queries are done
// with plain JavaScript here. Used only by the GitHub Pages demo. Keep both in step.

import { DEMO_PLACES, DEMO_THRESHOLDS, DEMO_NOTE } from "./places.js";
import { LABELS, labelHiddenGem } from "./discovery.js";

const SUGGESTION_COUNT = 5;
const MIN_PLACES_TO_COMPARE = 3;
const NO_LABEL = "No label";

const round2 = (x) => (x == null ? null : Math.round(Number(x) * 100) / 100);
const oneDecimal = (x) => (Math.round((Number(x) + Number.EPSILON) * 10) / 10).toFixed(1);
const percent = (part, whole) => Math.round((part / whole) * 100);

// Same as averageRatingBy() in model.js: one group per area or cuisine, best rated first.
function averageRatingBy(rows, nameOf) {
  const groups = new Map();
  for (const row of rows) {
    const name = nameOf(row);
    const g = groups.get(name) ?? { name, places: 0, total: 0 };
    g.places += 1;
    g.total += row.avg_rating;
    groups.set(name, g);
  }
  return [...groups.values()]
    .map((g) => ({ name: g.name, places: g.places, averageRating: round2(g.total / g.places) }))
    .sort(
      (a, b) =>
        b.averageRating - a.averageRating || b.places - a.places || a.name.localeCompare(b.name),
    );
}

function averagesFor(places) {
  if (places.length === 0) return null;
  const sum = (key) => places.reduce((s, p) => s + p[key], 0);
  return {
    places: places.length,
    averageRating: round2(sum("avgRating") / places.length),
    averageReviews: Math.round(sum("reviewCount") / places.length),
  };
}

// Food Place Suggestion: best rated hidden gems first; fewer reviews first when tied.
export function suggestFoodPlaces(places, count = SUGGESTION_COUNT) {
  return places
    .filter((p) => p.label === LABELS.HIDDEN_GEM)
    .sort((a, b) => b.avgRating - a.avgRating || a.reviewCount - b.reviewCount)
    .slice(0, count);
}

// Food Places Analysis: same sentences as analyseFoodPlaces() in findings.js.
export function analyseFoodPlaces({ totals, byArea, byCuisine, labelAverages, thresholds }) {
  if (!totals || totals.ratedPlaces === 0) return [];
  const findings = [];
  const best = (groups) => groups.find((g) => g.places >= MIN_PLACES_TO_COMPARE) ?? null;

  const area = best(byArea);
  if (area) {
    findings.push(
      `${area.name} has the highest average rating (${oneDecimal(area.averageRating)}) ` +
        `among areas with at least ${MIN_PLACES_TO_COMPARE} rated places.`,
    );
  }
  const cuisine = best(byCuisine);
  if (cuisine) {
    findings.push(
      `"${cuisine.name}" is the best rated cuisine (${oneDecimal(cuisine.averageRating)}) ` +
        `among cuisines with at least ${MIN_PLACES_TO_COMPARE} rated places.`,
    );
  }
  findings.push(
    `${totals.hiddenGems} of ${totals.ratedPlaces} rated places ` +
      `(${percent(totals.hiddenGems, totals.ratedPlaces)}%) are Hidden Gems: rated ` +
      `${thresholds.minRating} or higher with ${thresholds.maxReviews} reviews or fewer.`,
  );
  const gem = labelAverages?.hiddenGem;
  const popular = labelAverages?.popular;
  if (gem && popular) {
    findings.push(
      `Hidden Gems average ${oneDecimal(gem.averageRating)} stars from about ` +
        `${gem.averageReviews} reviews each, while Popular places average ` +
        `${oneDecimal(popular.averageRating)} stars from about ${popular.averageReviews} reviews.`,
    );
  }
  findings.push(
    `${percent(totals.halalPlaces, totals.ratedPlaces)}% of rated places ` +
      `(${totals.halalPlaces} of ${totals.ratedPlaces}) are marked halal.`,
  );
  return findings;
}

// Same answer shape as GET /api/analytics/overview.
export function getAnalyticsOverview() {
  const thresholds = DEMO_THRESHOLDS;
  const rows = DEMO_PLACES.filter((r) => r.avg_rating != null).sort(
    (a, b) =>
      b.avg_rating - a.avg_rating ||
      a.review_count - b.review_count ||
      a.name.localeCompare(b.name),
  );

  const places = rows.map((row) => ({
    id: row.id,
    name: row.name,
    area: row.area,
    cuisine: row.cuisine,
    isHalal: row.is_halal,
    priceLevel: row.price_level,
    avgRating: row.avg_rating,
    reviewCount: row.review_count,
    isSample: true,
    lat: row.lat,
    lng: row.lng,
    label: labelHiddenGem(row, thresholds),
  }));
  const hiddenGems = places.filter((p) => p.label === LABELS.HIDDEN_GEM);
  const popular = places.filter((p) => p.label === LABELS.POPULAR);
  const ratedPlaces = rows.length;
  const halalPlaces = rows.filter((r) => r.is_halal === true).length;

  const totals = {
    ratedPlaces,
    hiddenGems: hiddenGems.length,
    popular: popular.length,
    unlabelled: places.length - hiddenGems.length - popular.length,
    averageRating: round2(rows.reduce((s, r) => s + r.avg_rating, 0) / ratedPlaces),
    halalPlaces,
    halalShare: ratedPlaces > 0 ? round2(halalPlaces / ratedPlaces) : 0,
    samplePlaces: ratedPlaces,
  };
  const byArea = averageRatingBy(rows, (r) => r.area?.trim() || "Unknown area");
  const byCuisine = averageRatingBy(rows, (r) => (r.cuisine?.trim() || "unknown").toLowerCase());
  const labelAverages = { hiddenGem: averagesFor(hiddenGems), popular: averagesFor(popular) };

  return {
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
    note: DEMO_NOTE,
  };
}
