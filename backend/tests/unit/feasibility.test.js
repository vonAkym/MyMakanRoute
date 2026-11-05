// Feasibility study helpers (scripts/feasibility-helpers.js) and the ACO / brute-force options
// the study uses. No database.

const h = require("../../scripts/feasibility-helpers");
const {
  planVisitingOrderACO,
  mulberry32,
  TEXTBOOK_ACO,
} = require("../../src/modules/food-hopping/antColony");
const { bruteForceOrder } = require("../../src/modules/food-hopping/routeBaselines");

const thresholds = { minRating: 4.3, maxReviews: 100, popularMinReviews: 100 };
const place = (avg_rating, review_count, extra = {}) => ({ avg_rating, review_count, ...extra });

describe("number helpers", () => {
  test("round, percent and gapPercent", () => {
    expect(h.round(1.256, 2)).toBe(1.26);
    expect(h.round(null)).toBeNull();
    expect(h.percent(1, 3)).toBe(33.3);
    expect(h.percent(5, 0)).toBe(0);
    expect(h.gapPercent(110, 100)).toBeCloseTo(10);
    expect(h.average([])).toBeNull();
    expect(h.average([1, 2, 3])).toBe(2);
  });

  test("countBy groups items and names missing keys Unknown", () => {
    expect(h.countBy(["a", "b", "a", null], (x) => x)).toEqual({ a: 2, b: 1, Unknown: 1 });
  });
});

describe("hidden gem counting", () => {
  const places = [
    place(4.6, 40), // gem at every threshold pair below
    place(4.4, 150), // Popular now; gem only with max reviews 200
    place(4.1, 80), // no label now; gem only with min rating 4.0
    place(3.5, 500), // Popular
    place(null, 0), // no rating -> no label
  ];

  test("countLabels lists all three labels", () => {
    expect(h.countLabels(places, thresholds)).toEqual({
      "Hidden Gem": 1,
      Popular: 2,
      "No label": 2,
    });
  });

  test("hiddenGemSensitivity counts gems for each threshold pair", () => {
    const table = h.hiddenGemSensitivity(places, [4.0, 4.5], [50, 100, 200], 100);
    expect(table).toEqual([
      { minRating: 4.0, counts: { 50: 1, 100: 2, 200: 3 } },
      { minRating: 4.5, counts: { 50: 1, 100: 1, 200: 1 } },
    ]);
  });
});

describe("selectTripPlaces", () => {
  // 30 places on a line, ~111 m apart.
  const places = Array.from({ length: 30 }, (_, i) => ({
    id: i,
    lat: 5.4 + i * 0.001,
    lng: 100.3,
  }));

  test("same seed gives the same trip, with n different places", () => {
    const a = h.selectTripPlaces(places, 6, mulberry32(1));
    const b = h.selectTripPlaces(places, 6, mulberry32(1));
    expect(a).toEqual(b);
    expect(new Set(a.map((p) => p.id)).size).toBe(6);
  });

  test("picks only among the 2n places nearest to the anchor", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const [anchor, ...rest] = h.selectTripPlaces(places, 4, mulberry32(seed));
      // On a line, the 8 nearest places are at most 8 steps away from the anchor.
      for (const p of rest) expect(Math.abs(p.id - anchor.id)).toBeLessThanOrEqual(8);
    }
  });

  test("throws when there are too few places", () => {
    expect(() => h.selectTripPlaces(places.slice(0, 3), 4, mulberry32(1))).toThrow();
  });

  test("shuffle keeps every item", () => {
    expect(h.shuffle([1, 2, 3, 4], mulberry32(5)).sort()).toEqual([1, 2, 3, 4]);
  });
});

describe("summariseTrials", () => {
  const trial = (opt, improved, textbook, nn) => ({
    matrixMs: 10,
    optimum: opt == null ? null : { time: opt, ms: 4 },
    nn: { time: nn, ms: 0.1 },
    variants: { improved: { time: improved, ms: 2 }, textbook: { time: textbook, ms: 3 } },
  });

  test("optimal share, average gap and times", () => {
    const s = h.summariseTrials([
      trial(100, 100, 110, 120),
      trial(200, 200, 200, 200),
      trial(null, 300, 300, 300), // brute force skipped: not in the optimum numbers
    ]);
    expect(s.trials).toBe(3);
    expect(s.trialsWithOptimum).toBe(2);
    expect(s.avgOptimumMin).toBe(2.5);
    expect(s.variants.improved).toMatchObject({ optimalPercent: 100, avgGapPercent: 0 });
    expect(s.variants.textbook).toMatchObject({
      optimalPercent: 50,
      avgGapPercent: 5,
      maxGapPercent: 10,
      avgMs: 3,
    });
    expect(s.nearestNeighbour).toMatchObject({ optimalPercent: 50, avgGapPercent: 10 });
    expect(s.bruteForce.avgMs).toBe(4);
  });
});

describe("topGroupsByRating and formatTable", () => {
  test("keeps groups with enough places, best first", () => {
    const groups = [
      { name: "A", places: 1, averageRating: 5 },
      { name: "B", places: 3, averageRating: 4.2 },
      { name: "C", places: 4, averageRating: 4.5 },
      { name: "D", places: 5, averageRating: 4.0 },
      { name: "E", places: 6, averageRating: 3.9 },
    ];
    expect(h.topGroupsByRating(groups).map((g) => g.name)).toEqual(["C", "B", "D"]);
  });

  test("pads columns and shows null as -", () => {
    const text = h.formatTable(
      ["Name", "N"],
      [
        ["ab", 1],
        ["c", null],
      ],
    );
    expect(text.split("\n")).toEqual(["Name  N", "----  -", "ab    1", "c     -"]);
  });
});

describe("ACO and brute-force options used by the study", () => {
  const random = mulberry32(9);
  const pts = Array.from({ length: 9 }, () => [random() * 2000, random() * 2000]);
  const m = pts.map(([x1, y1]) => pts.map(([x2, y2]) => Math.round(Math.hypot(x1 - x2, y1 - y2))));

  test("textbook settings run, give a valid order and differ from the default params", () => {
    const result = planVisitingOrderACO(m, { ...TEXTBOOK_ACO, seed: 1 });
    expect(new Set(result.order).size).toBe(9);
    expect(result.params).toMatchObject({ beta: 3, elitist: false, trailLimits: false });
    expect(planVisitingOrderACO(m, { seed: 1 }).params).toMatchObject({
      elitist: true,
      trailLimits: true,
    });
  });

  test("brute force accepts a higher stop limit when asked", () => {
    expect(() => bruteForceOrder(m, 0)).toThrow(/limited to 8/);
    const best = bruteForceOrder(m, 0, 10);
    expect(best.order).toHaveLength(9);
    expect(planVisitingOrderACO(m, { seed: 1 }).totalTime).toBeGreaterThanOrEqual(best.totalTime);
  });
});
