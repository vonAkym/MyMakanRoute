// Hidden Gem Highlighting: pure functions (no database), so they are easy to unit test.

const LABELS = Object.freeze({ HIDDEN_GEM: "Hidden Gem", POPULAR: "Popular" });

// Turns a rating from the database (pg can return numeric as a string) into a number or null.
function toNumberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// The label rule, in plain words:
//   1. No rating, or no reviews at all -> no label. A rating with 0 reviews means nothing.
//   2. Rating at least minRating AND at most maxReviews reviews -> "Hidden Gem"
//      (well liked, but not many people know it yet).
//   3. More than popularMinReviews reviews -> "Popular" (whatever the rating).
//   4. Anything else (few reviews and a lower rating) -> no label.
// thresholds: { minRating, maxReviews, popularMinReviews } (from config.hiddenGem).
function labelHiddenGem(place, thresholds) {
  const rating = toNumberOrNull(place.avg_rating ?? place.avgRating);
  const reviews = toNumberOrNull(place.review_count ?? place.reviewCount) ?? 0;

  if (rating === null || reviews < 1) return null;
  if (rating >= thresholds.minRating && reviews <= thresholds.maxReviews) {
    return LABELS.HIDDEN_GEM;
  }
  if (reviews > thresholds.popularMinReviews) return LABELS.POPULAR;
  return null;
}

// Lower number = shown first.
const GROUP_ORDER = { [LABELS.HIDDEN_GEM]: 0, [LABELS.POPULAR]: 1 };
const NO_LABEL_GROUP = 2;

// The ranking rule, in plain words:
//   Hidden Gems first, then Popular places, then places with no label.
//   Inside each group, the nearest place comes first.
//   If two places are the same distance away, the higher rated one comes first.
// Each place must already have `label` and `distance_m` (or `distanceM`).
// Returns a new sorted array; the input is not changed.
function rankFoodPlaces(places) {
  const group = (p) => GROUP_ORDER[p.label] ?? NO_LABEL_GROUP;
  const distance = (p) => toNumberOrNull(p.distance_m ?? p.distanceM) ?? Infinity;
  const rating = (p) => toNumberOrNull(p.avg_rating ?? p.avgRating) ?? -1;

  return [...places].sort(
    (a, b) => group(a) - group(b) || distance(a) - distance(b) || rating(b) - rating(a),
  );
}

module.exports = { LABELS, labelHiddenGem, rankFoodPlaces };
