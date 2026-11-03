jest.mock("../../src/modules/food-discovery/model", () => ({
  findFoodPlacesNearby: jest.fn(),
  findFoodPlaceById: jest.fn(),
}));
const model = require("../../src/modules/food-discovery/model");
const { searchFoodPlaces, SAMPLE_NOTE } = require("../../src/modules/food-discovery/service");

afterEach(() => jest.clearAllMocks());

const MON_LUNCH = { mon: [["11:00", "15:00"]] };
const row = (id, extra) => ({
  id,
  name: id,
  avg_rating: 4.0,
  review_count: 10,
  distance_m: 100,
  is_sample: false,
  opening_hours: null,
  dietary: [],
  ...extra,
});
const BASE = { lat: 5.4, lng: 100.3, radius: 1500, limit: 50 };
// Monday 2 Nov 2026, 12:00 in Malaysia.
const MONDAY_NOON = new Date("2026-11-02T12:00:00+08:00");

test("openNow keeps only places whose structured hours say open at 'now' (Malaysia time)", async () => {
  model.findFoodPlacesNearby.mockResolvedValue([
    row("open", { opening_hours: MON_LUNCH }),
    row("closed", { opening_hours: { tue: [["11:00", "15:00"]] } }),
    row("osm-only", { opening_hours: { osm: "Mo 11:00-15:00" } }),
    row("no-hours"),
  ]);
  const data = await searchFoodPlaces({ ...BASE, openNow: true }, { now: MONDAY_NOON });
  expect(data.places.map((p) => p.id)).toEqual(["open"]);

  const evening = new Date("2026-11-02T19:00:00+08:00");
  const later = await searchFoodPlaces({ ...BASE, openNow: true }, { now: evening });
  expect(later.count).toBe(0);
});

test("without openNow, places with no hours are kept", async () => {
  model.findFoodPlacesNearby.mockResolvedValue([row("a"), row("b")]);
  const data = await searchFoodPlaces(BASE, { now: MONDAY_NOON });
  expect(data.count).toBe(2);
});

test("label filter, ranking, then limit", async () => {
  model.findFoodPlacesNearby.mockResolvedValue([
    row("pop", { avg_rating: 4.5, review_count: 900, distance_m: 50 }),
    row("gem-far", { avg_rating: 4.6, review_count: 40, distance_m: 800 }),
    row("gem-near", { avg_rating: 4.4, review_count: 20, distance_m: 300 }),
    row("plain", { avg_rating: 3.9, review_count: 20, distance_m: 10 }),
  ]);
  const all = await searchFoodPlaces({ ...BASE, limit: 3 });
  expect(all.places.map((p) => [p.id, p.label])).toEqual([
    ["gem-near", "Hidden Gem"],
    ["gem-far", "Hidden Gem"],
    ["pop", "Popular"],
  ]);

  const gems = await searchFoodPlaces({ ...BASE, label: "hidden_gem" });
  expect(gems.places.map((p) => p.id)).toEqual(["gem-near", "gem-far"]);
  const popular = await searchFoodPlaces({ ...BASE, label: "popular" });
  expect(popular.places.map((p) => p.id)).toEqual(["pop"]);
});

test("adds the sample note only when a returned place is sample data", async () => {
  model.findFoodPlacesNearby.mockResolvedValue([row("real")]);
  expect((await searchFoodPlaces(BASE)).note).toBeUndefined();
  model.findFoodPlacesNearby.mockResolvedValue([row("s", { is_sample: true })]);
  expect((await searchFoodPlaces(BASE)).note).toBe(SAMPLE_NOTE);
});
