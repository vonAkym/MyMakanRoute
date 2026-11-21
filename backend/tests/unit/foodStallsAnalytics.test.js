const { analyseFoodPlaces } = require("../../src/modules/food-stalls-analytics/findings");
const {
  suggestFoodPlaces,
  fitsStrictPreferences,
  matchFeatures,
} = require("../../src/modules/food-stalls-analytics/suggestion");

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

describe("suggestFoodPlaces (Food Place Suggestion, SRD 4.8.4)", () => {
  const p = (id, avgRating, reviewCount, label = "Hidden Gem", extra = {}) => ({
    id,
    name: `Stall ${id}`,
    area: "George Town",
    cuisine: "chinese",
    isHalal: false,
    priceLevel: 2,
    dietary: [],
    avgRating,
    reviewCount,
    label,
    ...extra,
  });
  const ids = (result) => result.suggestions.map((x) => x.id);

  test("no preferences and no trips: findings only (best rated hidden gems), at most 5", () => {
    const places = [
      p("pop", 4.9, 5000, "Popular"),
      p("g1", 4.4, 10),
      p("g2", 4.8, 80),
      p("g3", 4.9, 50),
      p("g4", 4.5, 5),
      p("g5", 4.3, 99),
      p("g6", 4.8, 30),
      p("none", 4.0, 20, null),
    ];
    const result = suggestFoodPlaces(places);
    expect(result.basedOn).toBe("findings");
    expect(ids(result)).toEqual(["g3", "g6", "g2", "g4", "g1"]);
    expect(result.suggestions[0]).toMatchObject({ matchedOn: ["hidden gem"] });
  });

  test("count can be changed and the input is not reordered", () => {
    const places = [p("a", 4.4, 10), p("b", 4.9, 10)];
    expect(ids(suggestFoodPlaces(places, { count: 1 }))).toEqual(["b"]);
    expect(places.map((x) => x.id)).toEqual(["a", "b"]);
  });

  test("strict preferences remove places that break halal, budget or dietary needs", () => {
    const halal = p("h", 4.5, 10, "Hidden Gem", { isHalal: true, dietary: ["vegetarian"] });
    const pricey = p("$", 4.5, 10, "Hidden Gem", { isHalal: true, priceLevel: 4 });
    const notHalal = p("n", 4.5, 10);
    const prefs = { halal: true, maxPrice: 2, dietary: ["vegetarian"] };
    expect(fitsStrictPreferences(halal, prefs)).toBe(true);
    expect(fitsStrictPreferences(pricey, prefs)).toBe(false);
    expect(fitsStrictPreferences(notHalal, prefs)).toBe(false);
    expect(fitsStrictPreferences(halal, { dietary: ["vegan"] })).toBe(false);
    expect(fitsStrictPreferences(pricey, {})).toBe(true);
  });

  test("match score counts cuisine, price, area and the hidden gem finding", () => {
    const place = p("x", 4.6, 12, "Hidden Gem", { cuisine: "malay;nasi kandar", area: "Gelugor" });
    expect(matchFeatures(place, { cuisine: ["malay"] })).toEqual(["cuisine", "hidden gem"]);
    expect(matchFeatures(place, { maxPrice: 2 })).toEqual(["price", "hidden gem"]);
    const past = [{ area: "Gelugor", cuisine: "malay", priceLevel: 2 }];
    expect(matchFeatures(place, {}, past)).toEqual(["cuisine", "price", "area", "hidden gem"]);
    // With past trips, price matches the levels chosen before, not just the budget.
    expect(matchFeatures(place, { maxPrice: 3 }, [{ priceLevel: 1 }])).toEqual(["hidden gem"]);
  });

  test("with preferences: highest score first, then rating; score 0 is left out", () => {
    const places = [
      p("gem-chinese", 4.9, 10),
      p("gem-malay", 4.4, 10, "Hidden Gem", { cuisine: "malay" }),
      p("popular-malay", 4.6, 900, "Popular", { cuisine: "malay" }),
      p("plain-indian", 4.0, 20, null, { cuisine: "indian" }),
    ];
    const result = suggestFoodPlaces(places, { preferences: { cuisine: ["malay"] } });
    expect(result.basedOn).toBe("preferences");
    expect(ids(result)).toEqual(["gem-malay", "gem-chinese", "popular-malay"]);
    expect(result.suggestions[0]).toMatchObject({ matchScore: 2 });
  });

  test("past choices alone also count as preferences", () => {
    const places = [
      p("far", 4.9, 10, "Hidden Gem", { area: "Air Itam" }),
      p("near", 4.4, 10, "Hidden Gem", { area: "Gelugor" }),
    ];
    const result = suggestFoodPlaces(places, { pastPlaces: [{ area: "Gelugor" }] });
    expect(result.basedOn).toBe("preferences");
    expect(ids(result)).toEqual(["near", "far"]);
  });

  test("places already in the user's trips are not suggested again", () => {
    const places = [p("visited", 4.9, 10), p("new", 4.4, 10)];
    const result = suggestFoodPlaces(places, {
      pastPlaces: [{ id: "visited", area: "George Town" }],
    });
    expect(ids(result)).toEqual(["new"]);
  });

  test("nothing fits the strict preferences -> empty list (the page hides the section)", () => {
    const result = suggestFoodPlaces([p("a", 4.8, 10)], { preferences: { halal: true } });
    expect(result.suggestions).toEqual([]);
  });
});
