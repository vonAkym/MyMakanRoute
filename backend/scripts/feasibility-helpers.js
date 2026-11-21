// Pure helper functions for scripts/feasibility.js (no database, no files), so they can be
// unit tested. They only count, average and pick things; the real logic (hidden gem rule,
// Dijkstra, ACO, baselines) stays in the modules and is reused by the script.

const { labelHiddenGem, LABELS } = require("../src/modules/food-discovery/hiddenGem");
const { haversineMeters } = require("../src/modules/food-hopping/travelGraph");

const NO_LABEL = "No label";

// Rounds to `decimals` places (default 1). null/undefined/NaN stay null.
function round(x, decimals = 1) {
  if (x == null || !Number.isFinite(Number(x))) return null;
  const f = 10 ** decimals;
  return Math.round(Number(x) * f) / f;
}

// part / whole as a percentage with one decimal; 0 when whole is 0.
function percent(part, whole) {
  return whole > 0 ? round((part / whole) * 100) : 0;
}

// How much worse `value` is than `optimum`, in percent (0 = equally good).
function gapPercent(value, optimum) {
  return optimum > 0 ? ((value - optimum) / optimum) * 100 : 0;
}

const average = (xs) => (xs.length === 0 ? null : xs.reduce((s, x) => s + x, 0) / xs.length);

// Counts items per key: countBy(["a", "b", "a"], (x) => x) -> { a: 2, b: 1 }.
function countBy(items, keyFn) {
  const counts = {};
  for (const item of items) {
    const key = keyFn(item) ?? "Unknown";
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

// Label of one place, with "No label" instead of null.
const labelOf = (place, thresholds) => labelHiddenGem(place, thresholds) ?? NO_LABEL;

// Counts per label for a list of places (database rows), always listing all three labels.
function countLabels(places, thresholds) {
  const counts = { [LABELS.HIDDEN_GEM]: 0, [LABELS.POPULAR]: 0, [NO_LABEL]: 0 };
  for (const p of places) counts[labelOf(p, thresholds)]++;
  return counts;
}

// Sensitivity table: number of hidden gems for every pair of (min rating, max reviews).
// Returns rows like { minRating: 4.3, counts: { 50: 3, 100: 7, 200: 9 } }.
function hiddenGemSensitivity(places, minRatings, maxReviewsList, popularMinReviews) {
  return minRatings.map((minRating) => {
    const counts = {};
    for (const maxReviews of maxReviewsList) {
      const thresholds = { minRating, maxReviews, popularMinReviews };
      counts[maxReviews] = places.filter(
        (p) => labelHiddenGem(p, thresholds) === LABELS.HIDDEN_GEM,
      ).length;
    }
    return { minRating, counts };
  });
}

// Shuffles a copy of the array with the given random function (Fisher-Yates).
function shuffle(items, random) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Picks n places for one benchmark trip, repeatably (same random function -> same trip).
// To keep walks realistic, it picks a random "anchor" place, then n - 1 more at random from
// the 2n places nearest to that anchor. The anchor is the start of the trip.
// places: [{ lat, lng, ... }] with at least n places.
function selectTripPlaces(places, n, random) {
  if (places.length < n) throw new Error(`Need at least ${n} places, got ${places.length}`);
  const anchor = places[Math.floor(random() * places.length)];
  const nearest = places
    .filter((p) => p !== anchor)
    .map((p) => ({ p, d: haversineMeters(anchor.lat, anchor.lng, p.lat, p.lng) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, 2 * n)
    .map(({ p }) => p);
  return [anchor, ...shuffle(nearest, random).slice(0, n - 1)];
}

// Sums up benchmark trials of one trip size.
// trial: { matrixMs, optimum: { time, ms } | null, nn: { time, ms },
//          variants: { <name>: { time, ms } } }
// Times are seconds; a trial without an optimum (brute force skipped) is left out of the
// "optimal" and "gap" numbers.
function summariseTrials(trials) {
  const withOptimum = trials.filter((t) => t.optimum);
  const variantNames = Object.keys(trials[0]?.variants ?? {});
  const variants = {};
  for (const name of variantNames) {
    variants[name] = {
      optimalPercent: withOptimum.length
        ? percent(
            withOptimum.filter((t) => t.variants[name].time <= t.optimum.time + 1e-6).length,
            withOptimum.length,
          )
        : null,
      avgGapPercent: round(
        average(withOptimum.map((t) => gapPercent(t.variants[name].time, t.optimum.time))),
        2,
      ),
      maxGapPercent: withOptimum.length
        ? round(
            Math.max(...withOptimum.map((t) => gapPercent(t.variants[name].time, t.optimum.time))),
            2,
          )
        : null,
      avgMs: round(average(trials.map((t) => t.variants[name].ms)), 2),
    };
  }
  return {
    trials: trials.length,
    trialsWithOptimum: withOptimum.length,
    avgMatrixMs: round(average(trials.map((t) => t.matrixMs)), 2),
    avgOptimumMin: round(average(withOptimum.map((t) => t.optimum.time / 60))),
    variants,
    nearestNeighbour: {
      optimalPercent: withOptimum.length
        ? percent(
            withOptimum.filter((t) => t.nn.time <= t.optimum.time + 1e-6).length,
            withOptimum.length,
          )
        : null,
      avgGapPercent: round(
        average(withOptimum.map((t) => gapPercent(t.nn.time, t.optimum.time))),
        2,
      ),
      avgMs: round(average(trials.map((t) => t.nn.ms)), 2),
    },
    bruteForce: {
      avgMs: round(average(withOptimum.map((t) => t.optimum.ms)), 2),
    },
  };
}

// Top k groups by average rating among groups with at least minPlaces places.
// groups: [{ name, places, averageRating }].
function topGroupsByRating(groups, minPlaces = 3, k = 3) {
  return groups
    .filter((g) => g.places >= minPlaces)
    .sort((a, b) => b.averageRating - a.averageRating || b.places - a.places)
    .slice(0, k);
}

// Plain-text table for the console: columns padded to the widest cell.
// headers: ["Name", "Rating"], rows: [["Nasi Kandar", 4.5], ...].
function formatTable(headers, rows) {
  const cells = [headers, ...rows].map((r) => r.map((c) => (c == null ? "-" : String(c))));
  const widths = headers.map((_, i) => Math.max(...cells.map((r) => r[i].length)));
  const line = (r) =>
    r
      .map((c, i) => c.padEnd(widths[i]))
      .join("  ")
      .trimEnd();
  return [
    line(cells[0]),
    widths.map((w) => "-".repeat(w)).join("  "),
    ...cells.slice(1).map(line),
  ].join("\n");
}

module.exports = {
  NO_LABEL,
  formatTable,
  round,
  percent,
  gapPercent,
  average,
  countBy,
  countLabels,
  hiddenGemSensitivity,
  shuffle,
  selectTripPlaces,
  summariseTrials,
  topGroupsByRating,
};
