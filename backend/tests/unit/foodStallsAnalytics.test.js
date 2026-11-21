const { analyseFoodPlaces } = require("../../src/modules/food-stalls-analytics/findings");
const {
  suggestFoodPlaces,
  fitsStrictPreferences,
  learnTasteProfile,
  cosineSimilarity,
  placeFeatures,
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

describe("Food Place Suggestion: learned taste profile + nearness (SRD 4.8.4)", () => {
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
    lat: 5.4145,
    lng: 100.3292,
    ...extra,
  });
  const ids = (result) => result.suggestions.map((x) => x.id);
  const KOMTAR = { lat: 5.4145, lng: 100.3292 };

  test("placeFeatures describes a place by cuisine words, area, price and label", () => {
    const place = p("x", 4.6, 12, "Hidden Gem", { cuisine: "Malay; Nasi Kandar", area: "Gelugor" });
    expect(placeFeatures(place)).toEqual([
      "cuisine:malay",
      "cuisine:nasi kandar",
      "area:gelugor",
      "price:2",
      "hidden-gem",
    ]);
  });

  test("the taste profile learns from trip history: 6 of 7 Malay stops -> Malay weighs 6/7", () => {
    const history = [
      ...Array.from({ length: 6 }, () => ({ cuisine: "malay", area: "Gelugor", priceLevel: 1 })),
      { cuisine: "chinese", area: "George Town", priceLevel: 2 },
    ];
    const profile = learnTasteProfile({}, history);
    expect(profile.get("cuisine:malay")).toBeCloseTo(6 / 7);
    expect(profile.get("cuisine:chinese")).toBeCloseTo(1 / 7);
    expect(profile.get("hidden-gem")).toBe(0.5); // prior from the analysis findings
    // A favourite cuisine on the Profile page adds 1.
    expect(learnTasteProfile({ cuisine: ["chinese"] }, history).get("cuisine:chinese")).toBeCloseTo(
      8 / 7,
    );
  });

  test("cosine similarity is 1 for the same direction and 0 with nothing in common", () => {
    const profile = new Map([
      ["cuisine:malay", 1],
      ["price:1", 1],
    ]);
    expect(cosineSimilarity(profile, ["cuisine:malay", "price:1"])).toBeCloseTo(1);
    expect(cosineSimilarity(profile, ["cuisine:thai"])).toBe(0);
  });

  test("no preferences and no trips: best rated hidden gems within 3 km (findings only)", () => {
    const places = [
      p("pop", 4.9, 5000, "Popular"),
      p("g1", 4.4, 10),
      p("g2", 4.8, 80),
      p("g3", 4.9, 50),
      p("far", 5.0, 5, "Hidden Gem", { lat: 5.3, lng: 100.2 }), // about 19 km away
      p("g4", 4.5, 5),
    ];
    const result = suggestFoodPlaces(places, { location: KOMTAR });
    expect(result.basedOn).toBe("findings");
    expect(ids(result)).toEqual(["g3", "g2", "g4", "g1"]);
    expect(result.suggestions[0].distanceM).toBe(0);
  });

  test("trip history decides: a Malay lover in Gelugor gets the Malay place first", () => {
    const history = Array.from({ length: 4 }, (_, k) => ({
      id: `past${k}`,
      cuisine: "malay",
      area: "Gelugor",
      priceLevel: 1,
    }));
    const places = [
      p("chinese-gem", 4.9, 10),
      p("malay", 4.2, 30, null, { cuisine: "malay", area: "Gelugor", priceLevel: 1 }),
      p("past0", 4.9, 10, "Hidden Gem", { cuisine: "malay", area: "Gelugor", priceLevel: 1 }),
    ];
    const result = suggestFoodPlaces(places, { pastPlaces: history, location: KOMTAR });
    expect(result.basedOn).toBe("preferences");
    // past0 was visited already, so it is not suggested again.
    expect(ids(result)).toEqual(["malay", "chinese-gem"]);
    expect(result.suggestions[0].matchedOn).toEqual(["cuisine", "price", "area"]);
  });

  test("with equal taste match, the nearer place ranks first; beyond 3 km is left out", () => {
    const places = [
      p("2km", 4.5, 10, "Hidden Gem", { lat: 5.4325, lng: 100.3292 }),
      p("200m", 4.5, 10, "Hidden Gem", { lat: 5.4163, lng: 100.3292 }),
      p("5km", 4.9, 10, "Hidden Gem", { lat: 5.4595, lng: 100.3292 }),
    ];
    const result = suggestFoodPlaces(places, {
      preferences: { cuisine: ["chinese"] },
      location: KOMTAR,
    });
    expect(ids(result)).toEqual(["200m", "2km"]);
    expect(result.suggestions[0].matchScore).toBeGreaterThan(result.suggestions[1].matchScore);
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
    expect(ids(suggestFoodPlaces([halal, pricey, notHalal], { preferences: prefs }))).toEqual([
      "h",
    ]);
  });

  test("count can be changed and the input is not reordered", () => {
    const places = [p("a", 4.4, 10), p("b", 4.9, 10)];
    expect(ids(suggestFoodPlaces(places, { count: 1 }))).toEqual(["b"]);
    expect(places.map((x) => x.id)).toEqual(["a", "b"]);
  });

  test("nothing fits the strict preferences -> empty list (the page hides the section)", () => {
    const result = suggestFoodPlaces([p("a", 4.8, 10)], { preferences: { halal: true } });
    expect(result.suggestions).toEqual([]);
  });
});
