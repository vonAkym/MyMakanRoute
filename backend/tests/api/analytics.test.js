const request = require("supertest");

jest.mock("../../src/modules/food-stalls-analytics/model", () => ({
  summariseRatedFoodPlaces: jest.fn(),
  averageRatingBy: jest.fn(),
  findRatedFoodPlaces: jest.fn(),
  findPlaceFeatures: jest.fn(),
  // Default: no located places, so no clusters (set per test when needed).
  findFoodPlaceLocations: jest.fn(async () => []),
}));
const model = require("../../src/modules/food-stalls-analytics/model");
const app = require("../../src/app");

afterEach(() => jest.clearAllMocks());

const place = (id, rating, reviews, extra) => ({
  id,
  name: `Stall ${id}`,
  area: "George Town",
  cuisine: "chinese",
  is_halal: false,
  price_level: 1,
  avg_rating: rating,
  review_count: reviews,
  is_sample: true,
  lat: 5.41,
  lng: 100.33,
  ...extra,
});

function mockSampleData() {
  model.summariseRatedFoodPlaces.mockResolvedValue({
    rated_places: 4,
    average_rating: 4.275,
    halal_places: 1,
    sample_places: 4,
  });
  model.averageRatingBy.mockImplementation(async (group) =>
    group === "area"
      ? [
          { name: "Pulau Tikus", places: 3, average_rating: 4.4333 },
          { name: "George Town", places: 1, average_rating: 3.9 },
        ]
      : [{ name: "chinese", places: 4, average_rating: 4.275 }],
  );
  // Order as SQL returns it: rating desc, then fewer reviews first.
  model.findRatedFoodPlaces.mockResolvedValue([
    place("a", 4.8, 90, { is_halal: true }),
    place("b", 4.8, 20),
    place("c", 4.4, 3000),
    place("d", 3.9, 10),
  ]);
}

describe("GET /api/analytics/overview", () => {
  test("returns totals, labels, groups, points, suggestions, findings and the sample note", async () => {
    mockSampleData();
    const res = await request(app).get("/api/analytics/overview");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const data = res.body.data;
    expect(data.totals).toEqual({
      ratedPlaces: 4,
      hiddenGems: 2,
      popular: 1,
      unlabelled: 1,
      averageRating: 4.28,
      halalPlaces: 1,
      halalShare: 0.25,
      samplePlaces: 4,
    });
    expect(data.labels).toEqual([
      { label: "Hidden Gem", count: 2 },
      { label: "Popular", count: 1 },
      { label: "No label", count: 1 },
    ]);
    expect(data.byArea[0]).toEqual({ name: "Pulau Tikus", places: 3, averageRating: 4.43 });
    expect(data.byCuisine).toEqual([{ name: "chinese", places: 4, averageRating: 4.28 }]);
    expect(data.points).toHaveLength(4);
    expect(data.points[2]).toEqual({
      id: "c",
      name: "Stall c",
      avgRating: 4.4,
      reviewCount: 3000,
      label: "Popular",
    });
    // Same rating 4.8: fewer reviews (less known) first. Popular/unlabelled left out.
    expect(data.suggestions.map((p) => p.id)).toEqual(["b", "a"]);
    expect(data.suggestions[0]).toMatchObject({ label: "Hidden Gem", isSample: true });
    expect(data.findings[0]).toBe(
      "Pulau Tikus has the highest average rating (4.4) among areas with at least 3 rated places.",
    );
    expect(data.note).toBe("Ratings for sample places are invented for testing.");
    expect(data.thresholds).toEqual({ minRating: 4.3, maxReviews: 100, popularMinReviews: 100 });
  });

  test("asks the model for both groups (area and cuisine)", async () => {
    mockSampleData();
    await request(app).get("/api/analytics/overview");
    expect(model.averageRatingBy.mock.calls.map((c) => c[0]).sort()).toEqual(["area", "cuisine"]);
  });

  test("no rated places -> zero totals, no findings, no note", async () => {
    model.summariseRatedFoodPlaces.mockResolvedValue({
      rated_places: 0,
      average_rating: null,
      halal_places: 0,
      sample_places: 0,
    });
    model.averageRatingBy.mockResolvedValue([]);
    model.findRatedFoodPlaces.mockResolvedValue([]);

    const res = await request(app).get("/api/analytics/overview");
    expect(res.status).toBe(200);
    expect(res.body.data.totals).toMatchObject({
      ratedPlaces: 0,
      averageRating: null,
      halalShare: 0,
    });
    expect(res.body.data.findings).toEqual([]);
    expect(res.body.data.suggestions).toEqual([]);
    expect(res.body.data).not.toHaveProperty("note");
  });

  test("database failure -> 500 INTERNAL_ERROR without leaking details", async () => {
    model.summariseRatedFoodPlaces.mockRejectedValue(new Error("connection refused at 10.0.0.1"));
    model.averageRatingBy.mockResolvedValue([]);
    model.findRatedFoodPlaces.mockResolvedValue([]);
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});

    const res = await request(app).get("/api/analytics/overview");
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe("INTERNAL_ERROR");
    expect(JSON.stringify(res.body)).not.toContain("10.0.0.1");
    spy.mockRestore();
  });
});

describe("Food Places Analysis: DBSCAN food clusters", () => {
  test("the overview reports food clusters and adds them to the findings", async () => {
    mockSampleData();
    const street = Array.from({ length: 6 }, (_, k) => ({
      id: `s${k}`,
      name: `Stall ${k}`,
      area: "Pulau Tikus",
      lat: 5.43 + k * 0.0001,
      lng: 100.31,
      avg_rating: k < 3 ? 4.6 : null,
      review_count: k < 3 ? 40 : 0,
    }));
    model.findFoodPlaceLocations.mockResolvedValueOnce([
      ...street,
      {
        id: "alone",
        name: "Alone",
        area: null,
        lat: 5.3,
        lng: 100.2,
        avg_rating: null,
        review_count: 0,
      },
    ]);
    const res = await request(app).get("/api/analytics/overview");
    expect(res.status).toBe(200);
    const { clusters, findings } = res.body.data;
    expect(clusters.settings).toEqual({ epsM: 60, minPoints: 6 });
    expect(clusters.noisePlaces).toBe(1);
    expect(clusters.clusters).toHaveLength(1);
    expect(clusters.clusters[0]).toMatchObject({
      places: 6,
      area: "Pulau Tikus",
      hiddenGems: 3,
      isHiddenGemArea: true,
    });
    expect(findings.some((f) => /DBSCAN\) found 1 food cluster/.test(f))).toBe(true);
  });
});

describe("Food Place Suggestion with preferences", () => {
  const PAST_ID = "11111111-1111-4111-8111-111111111111";

  test("overview: halal preference keeps only halal places and says what it is based on", async () => {
    mockSampleData();
    const res = await request(app).get("/api/analytics/overview?halal=true&cuisine=chinese");
    expect(res.status).toBe(200);
    expect(res.body.data.suggestionsBasedOn).toBe("preferences");
    expect(res.body.data.suggestions.map((p) => p.id)).toEqual(["a"]);
    expect(res.body.data.suggestions[0].matchedOn).toEqual(["cuisine", "hidden gem"]);
  });

  test("overview without preferences: findings only", async () => {
    mockSampleData();
    const res = await request(app).get("/api/analytics/overview");
    expect(res.body.data.suggestionsBasedOn).toBe("findings");
    expect(model.findPlaceFeatures).not.toHaveBeenCalled();
  });

  test("GET /api/analytics/suggestions uses past trips; ids that are not UUIDs are ignored", async () => {
    mockSampleData();
    model.findPlaceFeatures.mockResolvedValue([
      { id: PAST_ID, area: "George Town", cuisine: "chinese", price_level: 1 },
    ]);
    const res = await request(app).get(
      `/api/analytics/suggestions?pastPlaceIds=${PAST_ID},way-123,${PAST_ID}`,
    );
    expect(res.status).toBe(200);
    expect(model.findPlaceFeatures).toHaveBeenCalledWith([PAST_ID]);
    const { data } = res.body;
    expect(data.basedOn).toBe("preferences");
    // Hidden gems match all 4 features; the others 3 (no hidden gem label).
    expect(data.suggestions.map((p) => p.id)).toEqual(["b", "a", "c", "d"]);
    // Taste profile from the past stop: chinese, George Town, price 1 (+ hidden gem prior).
    expect(data.suggestions[0].similarity).toBeCloseTo(0.971, 2);
    expect(data.suggestions[0].matchedOn).toEqual(["cuisine", "price", "area", "hidden gem"]);
    expect(data.note).toBe("Ratings for sample places are invented for testing.");
  });

  test("with the user's location, only places within 3 km are suggested", async () => {
    mockSampleData();
    const near = await request(app).get("/api/analytics/suggestions?lat=5.41&lng=100.33");
    expect(near.body.data.suggestions.map((p) => p.id)).toEqual(["b", "a"]);
    expect(near.body.data.suggestions[0].distanceM).toBe(0);
    expect(near.body.data.radiusM).toBe(3000);
    const far = await request(app).get("/api/analytics/suggestions?lat=3.1&lng=101.6");
    expect(far.body.data.suggestions).toEqual([]);
  });

  test("lat without lng -> 400", async () => {
    const res = await request(app).get("/api/analytics/suggestions?lat=5.41");
    expect(res.status).toBe(400);
  });

  test("bad preference values -> 400 VALIDATION_ERROR", async () => {
    const res = await request(app).get("/api/analytics/suggestions?maxPrice=9&halal=maybe");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});
