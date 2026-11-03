const request = require("supertest");

jest.mock("../../src/modules/food-discovery/model", () => ({
  findFoodPlacesNearby: jest.fn(),
  findFoodPlaceById: jest.fn(),
}));
const model = require("../../src/modules/food-discovery/model");
const app = require("../../src/app");

afterEach(() => jest.clearAllMocks());

const ID = "3f1c2a4e-8b7d-4c1e-9a2b-1234567890ab";
const KOMTAR = "lat=5.4145&lng=100.3292";

const row = (extra) => ({
  id: ID,
  name: "Test Stall",
  cuisine: "chinese",
  area: "George Town",
  address: null,
  is_halal: null,
  price_level: 1,
  avg_rating: 4.5,
  review_count: 40,
  dietary: [],
  opening_hours: null,
  is_sample: true,
  lat: 5.41,
  lng: 100.33,
  distance_m: 123.4,
  ...extra,
});

describe("GET /api/discovery/places: validation", () => {
  test.each([
    ["missing lat", "lng=100.3", "query.lat"],
    ["missing lng", "lat=5.4", "query.lng"],
    ["empty lat", "lat=&lng=100.3", "query.lat"],
    ["lat out of range", "lat=91&lng=100.3", "query.lat"],
    ["lng out of range", "lat=5&lng=-181", "query.lng"],
    ["radius too small", `${KOMTAR}&radius=99`, "query.radius"],
    ["radius too large", `${KOMTAR}&radius=5001`, "query.radius"],
    ["maxPrice out of range", `${KOMTAR}&maxPrice=5`, "query.maxPrice"],
    ["halal not a boolean", `${KOMTAR}&halal=yes`, "query.halal"],
    ["openNow not a boolean", `${KOMTAR}&openNow=1`, "query.openNow"],
    ["unknown label", `${KOMTAR}&label=famous`, "query.label"],
    ["limit too large", `${KOMTAR}&limit=101`, "query.limit"],
    ["bad dietary tag", `${KOMTAR}&dietary=vegan;drop`, "query.dietary.0"],
  ])("%s -> 400 VALIDATION_ERROR", async (_name, query, path) => {
    const res = await request(app).get(`/api/discovery/places?${query}`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details.map((d) => d.path)).toContain(path);
    expect(model.findFoodPlacesNearby).not.toHaveBeenCalled();
  });
});

describe("GET /api/discovery/places: success", () => {
  test("uses defaults and returns the standard shape with label and sample note", async () => {
    model.findFoodPlacesNearby.mockResolvedValue([row()]);
    const res = await request(app).get(`/api/discovery/places?${KOMTAR}`);

    expect(res.status).toBe(200);
    expect(model.findFoodPlacesNearby).toHaveBeenCalledWith({
      lat: 5.4145,
      lng: 100.3292,
      radius: 1500,
      halal: undefined,
      maxPrice: undefined,
      cuisines: undefined,
      dietary: undefined,
    });
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual({
      count: 1,
      thresholds: { minRating: 4.3, maxReviews: 100, popularMinReviews: 100 },
      note: "Ratings for sample places are invented for testing.",
      places: [
        {
          id: ID,
          name: "Test Stall",
          cuisine: "chinese",
          area: "George Town",
          address: null,
          isHalal: null,
          priceLevel: 1,
          avgRating: 4.5,
          reviewCount: 40,
          dietary: [],
          openingHours: null,
          isSample: true,
          lat: 5.41,
          lng: 100.33,
          distanceM: 123,
          label: "Hidden Gem",
        },
      ],
    });
  });

  test("passes the filters to the model, parsed and normalised", async () => {
    model.findFoodPlacesNearby.mockResolvedValue([]);
    const res = await request(app).get(
      `/api/discovery/places?${KOMTAR}&radius=800&halal=true&maxPrice=2` +
        "&cuisine=Chinese,%20Nasi%20Kandar&dietary=vegetarian,VEGAN&limit=5",
    );
    expect(res.status).toBe(200);
    expect(model.findFoodPlacesNearby).toHaveBeenCalledWith({
      lat: 5.4145,
      lng: 100.3292,
      radius: 800,
      halal: true,
      maxPrice: 2,
      cuisines: ["chinese", "nasi kandar"],
      dietary: ["vegetarian", "vegan"],
    });
    expect(res.body.data).toEqual({
      count: 0,
      places: [],
      thresholds: expect.any(Object),
    });
  });

  test("halal=false switches the halal filter off", async () => {
    model.findFoodPlacesNearby.mockResolvedValue([]);
    await request(app).get(`/api/discovery/places?${KOMTAR}&halal=false`);
    expect(model.findFoodPlacesNearby.mock.calls[0][0].halal).toBe(false);
  });

  test("labels and ranks: gems first, then popular, then unlabelled; limit applied", async () => {
    model.findFoodPlacesNearby.mockResolvedValue([
      row({ id: "plain", avg_rating: 3.8, review_count: 30, distance_m: 20 }),
      row({ id: "popular", avg_rating: 4.4, review_count: 2000, distance_m: 50 }),
      row({ id: "gem-far", avg_rating: 4.3, review_count: 100, distance_m: 900 }),
      row({ id: "gem-near", avg_rating: 4.8, review_count: 12, distance_m: 400 }),
      row({ id: "unrated", avg_rating: null, review_count: 0, distance_m: 5 }),
    ]);
    const res = await request(app).get(`/api/discovery/places?${KOMTAR}`);
    expect(res.body.data.places.map((p) => [p.id, p.label])).toEqual([
      ["gem-near", "Hidden Gem"],
      ["gem-far", "Hidden Gem"],
      ["popular", "Popular"],
      ["unrated", null],
      ["plain", null],
    ]);

    const limited = await request(app).get(`/api/discovery/places?${KOMTAR}&limit=2`);
    expect(limited.body.data.places.map((p) => p.id)).toEqual(["gem-near", "gem-far"]);

    const popular = await request(app).get(`/api/discovery/places?${KOMTAR}&label=popular`);
    expect(popular.body.data.places.map((p) => p.id)).toEqual(["popular"]);
  });

  test("a database failure gives 500 without leaking details", async () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    model.findFoodPlacesNearby.mockRejectedValue(new Error("relation places does not exist"));
    const res = await request(app).get(`/api/discovery/places?${KOMTAR}`);
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toMatch(/relation/);
    spy.mockRestore();
  });
});

describe("GET /api/discovery/places/:id", () => {
  test("bad uuid -> 400 VALIDATION_ERROR", async () => {
    const res = await request(app).get("/api/discovery/places/not-a-uuid");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details[0].path).toBe("params.id");
    expect(model.findFoodPlaceById).not.toHaveBeenCalled();
  });

  test("missing place -> 404 NOT_FOUND", async () => {
    model.findFoodPlaceById.mockResolvedValue(null);
    const res = await request(app).get(`/api/discovery/places/${ID}`);
    expect(res.status).toBe(404);
    expect(res.body.error).toEqual({ code: "NOT_FOUND", message: "Food place not found" });
  });

  test("found -> one place with its label", async () => {
    const noDistance = row({ review_count: 500 });
    delete noDistance.distance_m;
    model.findFoodPlaceById.mockResolvedValue(noDistance);
    const res = await request(app).get(`/api/discovery/places/${ID}`);
    expect(res.status).toBe(200);
    expect(model.findFoodPlaceById).toHaveBeenCalledWith(ID);
    expect(res.body.data.place).toMatchObject({ id: ID, label: "Popular", isSample: true });
    expect(res.body.data.place.distanceM).toBeUndefined();
    expect(res.body.data.note).toBe("Ratings for sample places are invented for testing.");
  });
});
