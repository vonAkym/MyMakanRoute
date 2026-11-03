// Route Planner: POST /api/hopping/route with a mocked model and a small injected road graph.
// No database and no internet are used.

jest.mock("../../src/modules/food-hopping/model");

const request = require("supertest");
const app = require("../../src/app");
const model = require("../../src/modules/food-hopping/model");
const {
  buildTravelGraph,
  setTravelGraph,
  resetTravelGraph,
} = require("../../src/modules/food-hopping/travelGraph");
const { fixtureRawGraph } = require("../helpers/roadGraphFixture");

const id = (d) => `${d.repeat(8)}-${d.repeat(4)}-4${d.repeat(3)}-8${d.repeat(3)}-${d.repeat(12)}`;

// Five SAMPLE places, each a few metres from a node of the fixture graph.
const PLACES = [
  { id: id("1"), name: "Stall A", lat: 5.41501, lng: 100.33 },
  { id: id("2"), name: "Stall B", lat: 5.41501, lng: 100.332 },
  { id: id("3"), name: "Stall C", lat: 5.41399, lng: 100.331 },
  { id: id("4"), name: "Stall D", lat: 5.414, lng: 100.33001 },
  { id: id("5"), name: "Stall E", lat: 5.414, lng: 100.33199 },
].map((p) => ({ ...p, cuisine: "malay", avg_rating: 4.5, review_count: 20, is_sample: true }));

const ALL_IDS = PLACES.map((p) => p.id);

beforeAll(() => setTravelGraph(buildTravelGraph(fixtureRawGraph)));
afterAll(() => resetTravelGraph());

beforeEach(() => {
  model.findPlacesForRoute.mockImplementation(async (ids) =>
    PLACES.filter((p) => ids.includes(p.id)),
  );
});

const post = (body) => request(app).post("/api/hopping/route").send(body);

describe("POST /api/hopping/route validation", () => {
  test.each([
    ["only 1 place", { placeIds: [id("1")] }],
    [
      "11 places",
      {
        placeIds: Array.from(
          { length: 11 },
          (_, i) => `${100 + i}00000-0000-4000-8000-000000000000`,
        ),
      },
    ],
    ["duplicate places", { placeIds: [id("1"), id("1"), id("2")] }],
    ["a bad travel mode", { placeIds: [id("1"), id("2")], travelMode: "flying" }],
    ["startPlaceId not in the list", { placeIds: [id("1"), id("2")], startPlaceId: id("3") }],
    ["a non-uuid id", { placeIds: ["abc", id("2")] }],
    ["an unknown field", { placeIds: [id("1"), id("2")], extra: 1 }],
    ["a non-integer seed", { placeIds: [id("1"), id("2")], seed: 1.5 }],
  ])("rejects %s with 400 VALIDATION_ERROR", async (_name, body) => {
    const res = await post(body);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(model.findPlacesForRoute).not.toHaveBeenCalled();
  });

  test("duplicates are detected regardless of letter case", async () => {
    const res = await post({ placeIds: [id("a"), id("a").toUpperCase()] });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/hopping/route", () => {
  test("404 when a place does not exist", async () => {
    const missing = id("9");
    const res = await post({ placeIds: [id("1"), missing] });
    expect(res.status).toBe(404);
    expect(res.body.error).toMatchObject({ code: "NOT_FOUND", details: { missing: [missing] } });
  });

  test("plans a 5-stop walking route with the full response shape", async () => {
    const res = await post({ placeIds: ALL_IDS, seed: 42 });
    expect(res.status).toBe(200);
    const data = res.body.data;

    expect(data.travelMode).toBe("walking");
    expect(data.order).toHaveLength(5);
    expect(data.order[0].id).toBe(ALL_IDS[0]); // default start = first chosen place
    expect(new Set(data.order.map((p) => p.id)).size).toBe(5);
    expect(data.order[0]).toMatchObject({ name: "Stall A", is_sample: true });

    expect(data.legs).toHaveLength(4);
    for (const [k, leg] of data.legs.entries()) {
      expect(leg.fromPlaceId).toBe(data.order[k].id);
      expect(leg.toPlaceId).toBe(data.order[k + 1].id);
      expect(leg.timeS).toBeGreaterThan(0);
      expect(leg.distanceM).toBeGreaterThan(0);
      expect(leg.path.length).toBeGreaterThanOrEqual(2);
    }
    const legSum = data.legs.reduce((s, l) => s + l.timeS, 0);
    expect(data.totalTimeS).toBeCloseTo(legSum, 0);
    expect(data.totalDistanceM).toBeGreaterThan(0);

    expect(data.comparison.aco.totalTimeS).toBe(data.totalTimeS);
    expect(data.comparison.nearestNeighbour.order[0]).toBe(ALL_IDS[0]);
    expect(data.comparison.bruteForce.totalTimeS).toBeLessThanOrEqual(data.totalTimeS);
    expect(data.comparison.aco.totalTimeS).toBeLessThanOrEqual(
      data.comparison.nearestNeighbour.totalTimeS,
    );
    expect(data.algorithm).toMatchObject({ name: "ant-colony-optimisation", seed: 42 });
    expect(data.graph).toEqual({ source: "osm-roads", nodes: 8, edges: 8 });
  });

  test("the order starts at startPlaceId", async () => {
    const res = await post({ placeIds: ALL_IDS, startPlaceId: ALL_IDS[3] });
    expect(res.status).toBe(200);
    expect(res.body.data.order[0].id).toBe(ALL_IDS[3]);
  });

  test("same seed gives the same plan; driving mode works", async () => {
    const a = await post({ placeIds: ALL_IDS, seed: 7, travelMode: "driving" });
    const b = await post({ placeIds: ALL_IDS, seed: 7, travelMode: "driving" });
    expect(a.status).toBe(200);
    expect(a.body.data.travelMode).toBe("driving");
    expect(a.body.data.order.map((p) => p.id)).toEqual(b.body.data.order.map((p) => p.id));
  });

  test("422 when a place is far from every road", async () => {
    model.findPlacesForRoute.mockResolvedValueOnce([
      PLACES[0],
      { ...PLACES[1], lat: 3.1, lng: 101.6 }, // Kuala Lumpur, outside the graph
    ]);
    const res = await post({ placeIds: [ALL_IDS[0], ALL_IDS[1]] });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("PLACE_NOT_ON_ROAD_GRAPH");
  });
});
