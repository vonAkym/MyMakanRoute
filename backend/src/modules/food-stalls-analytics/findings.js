// Food Places Analysis: turns the analytics numbers into short plain-English findings.
// Pure function (no database), so it is easy to unit test.

// Groups (areas or cuisines) need at least this many rated places to be compared,
// so one 5-star stall does not make its area "the best".
const MIN_PLACES_TO_COMPARE = 3;

// Rounds half up to one decimal (4.55 -> "4.6"). toFixed alone gives "4.5" because 4.55 is
// stored as 4.5499999... in binary; the tiny epsilon corrects that.
const oneDecimal = (x) => (Math.round((Number(x) + Number.EPSILON) * 10) / 10).toFixed(1);
const percent = (part, whole) => Math.round((part / whole) * 100);

// Best group (highest average rating) with enough places, or null.
// Groups arrive best first, so the first match wins ties.
function bestGroup(groups, minPlaces) {
  return groups.find((g) => g.places >= minPlaces) ?? null;
}

// overview: { totals, byArea, byCuisine, labelAverages, thresholds }
// byArea / byCuisine must be sorted by averageRating, best first.
// Returns an array of 0 to 5 sentences.
function analyseFoodPlaces(overview, minPlaces = MIN_PLACES_TO_COMPARE) {
  const { totals, byArea = [], byCuisine = [], labelAverages, thresholds } = overview;
  if (!totals || totals.ratedPlaces === 0) return [];
  const findings = [];

  const area = bestGroup(byArea, minPlaces);
  if (area) {
    findings.push(
      `${area.name} has the highest average rating (${oneDecimal(area.averageRating)}) ` +
        `among areas with at least ${minPlaces} rated places.`,
    );
  }

  const cuisine = bestGroup(byCuisine, minPlaces);
  if (cuisine) {
    findings.push(
      `"${cuisine.name}" is the best rated cuisine (${oneDecimal(cuisine.averageRating)}) ` +
        `among cuisines with at least ${minPlaces} rated places.`,
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

module.exports = { analyseFoodPlaces, MIN_PLACES_TO_COMPARE };
