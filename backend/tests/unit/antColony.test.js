// Route Planner: Ant Colony Optimisation, seeded random numbers and the baseline methods.

const {
  planVisitingOrderACO,
  mulberry32,
  defaultAnts,
} = require("../../src/modules/food-hopping/antColony");
const {
  orderTime,
  nearestNeighbourOrder,
  bruteForceOrder,
} = require("../../src/modules/food-hopping/routeBaselines");

// Random but repeatable asymmetric time matrix (60 s to 900 s per leg).
function randomMatrix(n, seed) {
  const random = mulberry32(seed);
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 0 : 60 + Math.round(random() * 840))),
  );
}

// Travel-time-like matrix: random points on a 2 km square, time = straight distance x 1.3 at
// walking speed. Times obey the triangle rule, like real road travel times.
function pointsMatrix(n, seed) {
  const random = mulberry32(seed);
  const pts = Array.from({ length: n }, () => [random() * 2000, random() * 2000]);
  return pts.map(([x1, y1]) =>
    pts.map(([x2, y2]) => Math.round((Math.hypot(x1 - x2, y1 - y2) * 1.3) / 1.4)),
  );
}

function expectValidOrder(order, n, start) {
  expect(order).toHaveLength(n);
  expect(order[0]).toBe(start);
  expect(new Set(order).size).toBe(n); // every stop exactly once
}

describe("mulberry32", () => {
  test("same seed gives the same sequence, numbers in [0, 1)", () => {
    const a = mulberry32(7);
    const b = mulberry32(7);
    for (let i = 0; i < 100; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
    expect(mulberry32(8)()).not.toBe(mulberry32(7)());
  });
});

describe("planVisitingOrderACO", () => {
  test("visits every stop exactly once and starts at startIndex", () => {
    const m = randomMatrix(9, 1);
    for (const start of [0, 4, 8]) {
      const result = planVisitingOrderACO(m, { startIndex: start, seed: 3 });
      expectValidOrder(result.order, 9, start);
      expect(result.totalTime).toBe(orderTime(m, result.order));
    }
  });

  test("same seed gives the same result", () => {
    const m = randomMatrix(10, 2);
    const a = planVisitingOrderACO(m, { seed: 99 });
    const b = planVisitingOrderACO(m, { seed: 99 });
    expect(a).toEqual(b);
  });

  test.each([5, 6, 7, 8])("matches the brute-force optimum for n = %i", (n) => {
    for (const seed of [11, 22, 33]) {
      const m = pointsMatrix(n, seed * n);
      const aco = planVisitingOrderACO(m, { startIndex: 0, seed });
      const best = bruteForceOrder(m, 0);
      expect(aco.totalTime).toBe(best.totalTime);
    }
  });

  test("on harder random (asymmetric) matrices: optimal in most cases, not worse than NN here", () => {
    // ACO is a heuristic, so it is not expected to be optimal every time here.
    let optimal = 0;
    let runs = 0;
    for (let n = 5; n <= 8; n++) {
      for (let seed = 1; seed <= 10; seed++) {
        const m = randomMatrix(n, seed * 100 + n);
        const aco = planVisitingOrderACO(m, { seed });
        expect(aco.totalTime).toBeLessThanOrEqual(nearestNeighbourOrder(m, 0).totalTime);
        if (aco.totalTime === bruteForceOrder(m, 0).totalTime) optimal++;
        runs++;
      }
    }
    expect(optimal / runs).toBeGreaterThanOrEqual(0.9);
  });

  test("beats nearest neighbour when the greedy choice is a trap", () => {
    // From 0 the closest stop is 1 (10 s), but from 1 everything else is far.
    // Best: 0 -> 2 -> 3 -> 1 = 20 + 10 + 10 = 40. Greedy: 0 -> 1 -> 2 -> 3 = 10 + 50 + 10 = 70.
    const m = [
      [0, 10, 20, 100],
      [10, 0, 50, 100],
      [20, 50, 0, 10],
      [100, 10, 10, 0],
    ];
    const nn = nearestNeighbourOrder(m, 0);
    const aco = planVisitingOrderACO(m, { seed: 1 });
    expect(nn.totalTime).toBe(70);
    expect(aco.totalTime).toBe(40);
    expect(aco.totalTime).toBeLessThan(nn.totalTime);
  });

  test("n = 1 and n = 2 are handled directly", () => {
    expect(planVisitingOrderACO([[0]])).toMatchObject({ order: [0], totalTime: 0 });
    const m2 = [
      [0, 30],
      [45, 0],
    ];
    expect(planVisitingOrderACO(m2)).toMatchObject({ order: [0, 1], totalTime: 30 });
    expect(planVisitingOrderACO(m2, { startIndex: 1 })).toMatchObject({
      order: [1, 0],
      totalTime: 45,
    });
  });

  test("uses the documented defaults and reports iterations", () => {
    const result = planVisitingOrderACO(randomMatrix(6, 5));
    expect(result.params).toMatchObject({ ants: defaultAnts(6), alpha: 1, beta: 2, seed: 42 });
    expect(defaultAnts(3)).toBe(10);
    expect(defaultAnts(10)).toBe(20);
    expect(result.iterationsRun).toBeGreaterThan(0);
    expect(result.iterationsRun).toBeLessThanOrEqual(200);
    expect(result.bestFoundAtIteration).toBeLessThanOrEqual(result.iterationsRun);
  });
});

describe("baselines", () => {
  test("nearest neighbour picks the closest unvisited stop each time", () => {
    const m = [
      [0, 5, 1],
      [5, 0, 2],
      [1, 2, 0],
    ];
    expect(nearestNeighbourOrder(m, 0)).toEqual({ order: [0, 2, 1], totalTime: 3 });
  });

  test("brute force finds the optimum and refuses more than 8 stops", () => {
    const m = randomMatrix(6, 4);
    const best = bruteForceOrder(m, 2);
    expectValidOrder(best.order, 6, 2);
    expect(best.totalTime).toBeLessThanOrEqual(nearestNeighbourOrder(m, 2).totalTime);
    expect(() => bruteForceOrder(randomMatrix(9, 1), 0)).toThrow(/8 stops/);
    expect(bruteForceOrder([[0]], 0)).toEqual({ order: [0], totalTime: 0 });
  });
});
