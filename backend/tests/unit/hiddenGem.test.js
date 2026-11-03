const {
  LABELS,
  labelHiddenGem,
  rankFoodPlaces,
} = require("../../src/modules/food-discovery/hiddenGem");

const DEFAULTS = { minRating: 4.3, maxReviews: 100, popularMinReviews: 100 };
const label = (avg_rating, review_count, t = DEFAULTS) =>
  labelHiddenGem({ avg_rating, review_count }, t);

describe("labelHiddenGem (default thresholds 4.3 / 100 / >100)", () => {
  test.each([
    [4.3, 100, "Hidden Gem"], // exactly on both thresholds
    [4.3, 101, "Popular"], // one review too many for a gem
    [4.29, 50, null], // rating just below
    [4.9, 100, "Hidden Gem"],
    [4.9, 101, "Popular"],
    [3.0, 500, "Popular"], // Popular ignores rating
    [3.0, 100, null], // 100 is not "more than 100"
    [4.3, 1, "Hidden Gem"],
    [5.0, 0, null], // a rating with 0 reviews means nothing
  ])("rating %p with %p reviews -> %p", (rating, reviews, expected) => {
    expect(label(rating, reviews)).toBe(expected);
  });

  test("no rating gives no label, even with many reviews", () => {
    expect(label(null, 50)).toBeNull();
    expect(label(null, 5000)).toBeNull();
    expect(label(undefined, 10)).toBeNull();
  });

  test("accepts numeric strings from the database and camelCase fields", () => {
    expect(label("4.5", 30)).toBe(LABELS.HIDDEN_GEM);
    expect(labelHiddenGem({ avgRating: 4.5, reviewCount: 300 }, DEFAULTS)).toBe(LABELS.POPULAR);
  });

  test("uses custom thresholds", () => {
    const strict = { minRating: 4.6, maxReviews: 20, popularMinReviews: 500 };
    expect(label(4.6, 20, strict)).toBe("Hidden Gem");
    expect(label(4.5, 20, strict)).toBeNull();
    expect(label(4.6, 21, strict)).toBeNull();
    expect(label(4.0, 500, strict)).toBeNull();
    expect(label(4.0, 501, strict)).toBe("Popular");
  });
});

describe("rankFoodPlaces", () => {
  test("Hidden Gems first, then Popular, then unlabelled; nearest first in each group", () => {
    const places = [
      { id: "none-near", label: null, distance_m: 10, avg_rating: 4.0 },
      { id: "pop-far", label: "Popular", distance_m: 900, avg_rating: 4.0 },
      { id: "gem-far", label: "Hidden Gem", distance_m: 1200, avg_rating: 4.4 },
      { id: "pop-near", label: "Popular", distance_m: 100, avg_rating: 4.0 },
      { id: "gem-near", label: "Hidden Gem", distance_m: 300, avg_rating: 4.4 },
      { id: "none-far", label: null, distance_m: 2000, avg_rating: null },
    ];
    expect(rankFoodPlaces(places).map((p) => p.id)).toEqual([
      "gem-near",
      "gem-far",
      "pop-near",
      "pop-far",
      "none-near",
      "none-far",
    ]);
  });

  test("same distance: higher rating first (null rating last)", () => {
    const places = [
      { id: "low", label: null, distanceM: 50, avgRating: 3.5 },
      { id: "unrated", label: null, distanceM: 50, avgRating: null },
      { id: "high", label: null, distanceM: 50, avgRating: 4.8 },
    ];
    expect(rankFoodPlaces(places).map((p) => p.id)).toEqual(["high", "low", "unrated"]);
  });

  test("does not change the input array", () => {
    const places = [
      { id: "b", label: null, distance_m: 2 },
      { id: "a", label: "Hidden Gem", distance_m: 1 },
    ];
    rankFoodPlaces(places);
    expect(places.map((p) => p.id)).toEqual(["b", "a"]);
  });
});
