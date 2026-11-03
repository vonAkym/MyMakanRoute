const { analyseFoodPlaces } = require("../../src/modules/food-stalls-analytics/findings");
const { suggestFoodPlaces } = require("../../src/modules/food-stalls-analytics/service");

const thresholds = { minRating: 4.3, maxReviews: 100, popularMinReviews: 100 };

const baseOverview = () => ({
  totals: { ratedPlaces: 10, hiddenGems: 4, halalPlaces: 3 },
  byArea: [
    { name: "Air Itam", places: 1, averageRating: 4.9 },
    { name: "Pulau Tikus", places: 6, averageRating: 4.42 },
    { name: "George Town", places: 3, averageRating: 4.1 },
  ],
  byCuisine: [
    { name: "cafe", places: 2, averageRating: 4.8 },
    { name: "hawker", places: 5, averageRating: 4.25 },
  ],
  labelAverages: {
    hiddenGem: { places: 4, averageRating: 4.55, averageReviews: 48 },
    popular: { places: 3, averageRating: 4.2, averageReviews: 1890 },
  },
  thresholds,
});

describe("analyseFoodPlaces (Food Places Analysis)", () => {
  test("writes area, cuisine, hidden gem, label comparison and halal sentences", () => {
    expect(analyseFoodPlaces(baseOverview())).toEqual([
      "Pulau Tikus has the highest average rating (4.4) among areas with at least 3 rated places.",
      '"hawker" is the best rated cuisine (4.3) among cuisines with at least 3 rated places.',
      "4 of 10 rated places (40%) are Hidden Gems: rated 4.3 or higher with 100 reviews or fewer.",
      "Hidden Gems average 4.6 stars from about 48 reviews each, while Popular places average 4.2 stars from about 1890 reviews.",
      "30% of rated places (3 of 10) are marked halal.",
    ]);
  });

  test("skips groups with too few places (a single 5-star stall does not win)", () => {
    const findings = analyseFoodPlaces(baseOverview());
    expect(findings.join(" ")).not.toContain("Air Itam");
    expect(findings.join(" ")).not.toContain('"cafe"');
  });

  test("leaves out sentences it has no data for", () => {
    const overview = baseOverview();
    overview.byArea = [{ name: "Gelugor", places: 2, averageRating: 4.5 }];
    overview.byCuisine = [];
    overview.labelAverages = { hiddenGem: null, popular: null };
    expect(analyseFoodPlaces(overview)).toEqual([
      "4 of 10 rated places (40%) are Hidden Gems: rated 4.3 or higher with 100 reviews or fewer.",
      "30% of rated places (3 of 10) are marked halal.",
    ]);
  });

  test("the minimum group size can be changed", () => {
    expect(analyseFoodPlaces(baseOverview(), 1)[0]).toContain("Air Itam");
  });

  test("no rated places -> no findings", () => {
    expect(analyseFoodPlaces({ ...baseOverview(), totals: { ratedPlaces: 0 } })).toEqual([]);
    expect(analyseFoodPlaces({})).toEqual([]);
  });
});

describe("suggestFoodPlaces (Food Place Suggestion)", () => {
  const p = (id, avgRating, reviewCount, label = "Hidden Gem") => ({
    id,
    avgRating,
    reviewCount,
    label,
  });

  test("only hidden gems, best rating first, fewer reviews breaks ties, at most 5", () => {
    const places = [
      p("pop", 4.9, 5000, "Popular"),
      p("g1", 4.4, 10),
      p("g2", 4.8, 80),
      p("g3", 4.8, 15),
      p("none", 4.0, 5, null),
      p("g4", 4.5, 30),
      p("g5", 4.3, 99),
      p("g6", 4.6, 50),
    ];
    expect(suggestFoodPlaces(places).map((x) => x.id)).toEqual(["g3", "g2", "g6", "g4", "g1"]);
  });

  test("count can be changed and the input is not reordered", () => {
    const places = [p("a", 4.4, 10), p("b", 4.9, 10)];
    expect(suggestFoodPlaces(places, 1).map((x) => x.id)).toEqual(["b"]);
    expect(places.map((x) => x.id)).toEqual(["a", "b"]);
  });
});
