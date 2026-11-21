// Route Planner: travel graph building, main component, nearest node and fallback graph.

const {
  buildTravelGraph,
  nearestNode,
  buildKnnFallbackGraph,
  haversineMeters,
  TRAVEL_SPEEDS,
  FALLBACK_DETOUR_FACTOR,
  setTravelGraph,
  getTravelGraph,
  resetTravelGraph,
} = require("../../src/modules/food-hopping/travelGraph");
const { fixtureRawGraph } = require("../helpers/roadGraphFixture");

describe("haversineMeters", () => {
  test("0.001 degree of latitude is about 111 m", () => {
    expect(haversineMeters(5.4, 100.3, 5.401, 100.3)).toBeCloseTo(111.2, 0);
  });
});

describe("buildTravelGraph", () => {
  const travel = buildTravelGraph(fixtureRawGraph);

  test("walking uses every walkable edge in both directions", () => {
    const w = travel.modes.walking;
    expect(w.adj[2].map((e) => e.to)).toContain(1); // one-way ignored on foot
    expect(w.adj[3].map((e) => e.to)).toContain(4); // footway
    expect(w.adj[0][0].timeS).toBeCloseTo(110.7 / TRAVEL_SPEEDS.walkingMps, 6);
  });

  test("driving respects one-way streets and skips footways", () => {
    const d = travel.modes.driving;
    expect(d.adj[1].map((e) => e.to)).toContain(2);
    expect(d.adj[2].map((e) => e.to)).not.toContain(1);
    expect(d.adj[3].map((e) => e.to)).not.toContain(4);
    // residential = 20 km/h
    expect(d.adj[0][0].timeS).toBeCloseTo(110.7 / (20 / 3.6), 6);
  });

  test("main component excludes the separate road piece", () => {
    for (const mode of ["walking", "driving"]) {
      const m = travel.modes[mode];
      expect(m.mainComponentSize).toBe(6);
      expect(m.inMain[6]).toBe(0);
      expect(m.usableNodes).toBe(8);
    }
  });
});

describe("nearestNode", () => {
  const travel = buildTravelGraph(fixtureRawGraph);

  test("snaps to the closest node and reports the distance", () => {
    const snap = nearestNode(travel, 5.4141, 100.3312, "walking");
    expect(snap.node).toBe(4);
    expect(snap.distanceM).toBeCloseTo(haversineMeters(5.4141, 100.3312, 5.414, 100.331), 6);
  });

  test("never snaps to a node outside the main component", () => {
    // Right next to node 6, but node 6 is in the isolated piece.
    const snap = nearestNode(travel, 5.45, 100.3, "walking");
    expect(snap.node).not.toBe(6);
    expect(snap.node).not.toBe(7);
  });

  test("returns null when nothing is within the search area", () => {
    expect(nearestNode(travel, 3.1, 101.6, "walking")).toBeNull();
  });
});

describe("buildKnnFallbackGraph", () => {
  test("links each place to its nearest places with the detour factor", () => {
    const points = [
      { lat: 5.41, lng: 100.33 },
      { lat: 5.411, lng: 100.33 },
      { lat: 5.412, lng: 100.33 },
    ];
    const g = buildKnnFallbackGraph(points);
    expect(g.source).toBe("knn-fallback");
    expect(g.edgeCount).toBe(3); // complete graph, each pair once
    const e = g.modes.walking.adj[0].find((x) => x.to === 1);
    expect(e.distM).toBeCloseTo(
      haversineMeters(5.41, 100.33, 5.411, 100.33) * FALLBACK_DETOUR_FACTOR,
    );
  });
});

describe("getTravelGraph injection", () => {
  afterEach(() => resetTravelGraph());

  test("returns an injected graph", () => {
    const g = buildTravelGraph(fixtureRawGraph);
    setTravelGraph(g);
    expect(getTravelGraph()).toBe(g);
  });
});
