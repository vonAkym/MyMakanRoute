// Route Planner: binary min-heap, Dijkstra, path rebuilding and the time matrix.

const {
  MinHeap,
  shortestTravelTime,
  rebuildPath,
  buildTimeMatrix,
} = require("../../src/modules/food-hopping/dijkstra");
const { buildTravelGraph, TRAVEL_SPEEDS } = require("../../src/modules/food-hopping/travelGraph");
const { fixtureRawGraph } = require("../helpers/roadGraphFixture");

describe("MinHeap", () => {
  test("pops items in ascending key order", () => {
    const heap = new MinHeap();
    const keys = [5, 3, 9, 1, 7, 3, 0, 8];
    keys.forEach((k, i) => heap.push(k, `v${i}`));
    const out = [];
    while (heap.size > 0) out.push(heap.pop().key);
    expect(out).toEqual([...keys].sort((a, b) => a - b));
  });

  test("pop on an empty heap returns undefined", () => {
    expect(new MinHeap().pop()).toBeUndefined();
  });
});

// Hand-drawn graph (times in seconds = distances in metres here):
//   0 -> 1 (10), 1 -> 2 (10), 0 -> 2 (50): the direct edge is LONGER than going via 1.
//   2 -> 3 (5) one-way only; 3 -> 0 (100).
//   4 has no edges at all (unreachable).
function handGraph() {
  const edge = (to, t) => ({ to, timeS: t, distM: t, edgeId: -1, reverse: false });
  return {
    lat: [0, 0, 0, 0, 0],
    lng: [0, 1, 2, 3, 4],
    shapes: [],
    adj: [[edge(1, 10), edge(2, 50)], [edge(2, 10)], [edge(3, 5)], [edge(0, 100)], []],
  };
}

describe("shortestTravelTime (Dijkstra)", () => {
  test("prefers a 2-hop path over a longer direct edge", () => {
    const { times, distances } = shortestTravelTime(handGraph(), 0, [2, 3]);
    expect(times.get(2)).toBe(20);
    expect(distances.get(2)).toBe(20);
    expect(times.get(3)).toBe(25);
  });

  test("respects one-way edges", () => {
    // 3 cannot go straight to 2 (the edge is 2 -> 3 only), so it must go 3 -> 0 -> 1 -> 2.
    const { times } = shortestTravelTime(handGraph(), 3, [2]);
    expect(times.get(2)).toBe(120);
  });

  test("returns Infinity for an unreachable node", () => {
    const { times, distances } = shortestTravelTime(handGraph(), 0, [4]);
    expect(times.get(4)).toBe(Infinity);
    expect(distances.get(4)).toBe(Infinity);
  });

  test("source to itself is 0", () => {
    expect(shortestTravelTime(handGraph(), 1, [1]).times.get(1)).toBe(0);
  });

  test("rebuildPath follows the predecessors", () => {
    const g = handGraph();
    const { prev } = shortestTravelTime(g, 0, [3]);
    expect(rebuildPath(g, prev, 0, 3)).toEqual([
      [0, 0],
      [0, 1],
      [0, 2],
      [0, 3],
    ]);
    expect(rebuildPath(g, shortestTravelTime(g, 0, [4]).prev, 0, 4)).toBeNull();
  });
});

describe("rebuildPath with edge shapes", () => {
  test("includes the in-between points of an edge, reversed when walked backwards", () => {
    const walking = buildTravelGraph(fixtureRawGraph).modes.walking;
    // On foot the one-way edge 1 -> 2 may be used backwards (2 -> 1).
    const { prev } = shortestTravelTime(walking, 2, [0]);
    expect(rebuildPath(walking, prev, 2, 0)).toEqual([
      [5.415, 100.332],
      [5.415, 100.3315],
      [5.415, 100.331],
      [5.415, 100.33],
    ]);
  });
});

describe("buildTimeMatrix", () => {
  const travel = buildTravelGraph(fixtureRawGraph);
  // Stops placed exactly on nodes 0, 2 and 5.
  const stops = [
    { lat: 5.415, lng: 100.33 },
    { lat: 5.415, lng: 100.332 },
    { lat: 5.414, lng: 100.332 },
  ];

  test("walking: n x n matrix with zero diagonal and walking times", () => {
    const m = buildTimeMatrix(stops, "walking", travel);
    expect(m.timeS).toHaveLength(3);
    for (let i = 0; i < 3; i++) expect(m.timeS[i][i]).toBe(0);
    expect(m.distanceM[0][1]).toBeCloseTo(221.4, 1);
    expect(m.timeS[0][1]).toBeCloseTo(221.4 / TRAVEL_SPEEDS.walkingMps, 1);
    // Walking ignores one-way rules: same time both ways.
    expect(m.timeS[1][0]).toBeCloseTo(m.timeS[0][1], 6);
    expect(m.source).toBe("osm-roads");
  });

  test("driving: a one-way street makes the way back longer", () => {
    const m = buildTimeMatrix(stops, "driving", travel);
    expect(m.distanceM[0][1]).toBeCloseTo(221.4, 1); // 0 -> 1 -> 2
    // 2 -> 0 by car cannot use 2 -> 1, so it goes 2 -> 5 -> 4 -> 1 -> 0.
    expect(m.distanceM[1][0]).toBeCloseTo(111.2 + 110.7 + 111.2 + 110.7, 1);
  });

  test("adds the snap distance at both ends of a leg", () => {
    const offRoad = [
      { lat: 5.4152, lng: 100.33 }, // about 22 m north of node 0
      { lat: 5.415, lng: 100.332 },
    ];
    const m = buildTimeMatrix(offRoad, "walking", travel);
    expect(m.snaps[0].node).toBe(0);
    expect(m.snaps[0].distanceM).toBeCloseTo(22.2, 0);
    expect(m.distanceM[0][1]).toBeCloseTo(221.4 + m.snaps[0].distanceM, 1);
  });

  test("pathBetween starts and ends at the places", () => {
    const m = buildTimeMatrix(stops, "walking", travel);
    const p = m.pathBetween(0, 2);
    expect(p[0]).toEqual([5.415, 100.33]);
    expect(p[p.length - 1]).toEqual([5.414, 100.332]);
  });

  test("rejects a place far from every road", () => {
    expect(() => buildTimeMatrix([stops[0], { lat: 5.3, lng: 100.2 }], "walking", travel)).toThrow(
      expect.objectContaining({ status: 422, code: "PLACE_NOT_ON_ROAD_GRAPH" }),
    );
  });

  test("uses the k-nearest-neighbour fallback when there is no road graph", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const m = buildTimeMatrix(stops, "walking", null);
    expect(m.source).toBe("knn-fallback");
    expect(warn).toHaveBeenCalled();
    expect(Number.isFinite(m.timeS[0][2])).toBe(true);
    warn.mockRestore();
  });
});
