const request = require("supertest");

jest.mock("../../src/modules/food-stalls-analytics/model", () => ({
  summariseRatedFoodPlaces: jest.fn(),
  averageRatingBy: jest.fn(),
  findRatedFoodPlaces: jest.fn(),
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
