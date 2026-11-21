// Food Places Analysis: DBSCAN food clusters (unsupervised learning on place locations).

const {
  dbscan,
  findFoodClusters,
  describeFoodClusters,
  NOISE,
} = require("../../src/modules/food-stalls-analytics/clustering");

const thresholds = { minRating: 4.3, maxReviews: 100, popularMinReviews: 100 };

// n points in a tight group around (lat, lng): about 10 m apart in a row.
const group = (lat, lng, n, extra = {}) =>
  Array.from({ length: n }, (_, k) => ({
    id: `${lat}-${k}`,
    name: `Place ${lat}-${k}`,
    lat: lat + k * 0.0001,
    lng,
    avgRating: null,
    reviewCount: 0,
    label: null,
    ...extra,
  }));

describe("dbscan", () => {
  test("finds two dense groups and marks a lone place as noise", () => {
    const points = [
      ...group(5.41, 100.33, 6),
      ...group(5.43, 100.31, 6),
      { lat: 5.38, lng: 100.3 },
    ];
    const labels = dbscan(points, { epsM: 60, minPoints: 6 });
    expect(new Set(labels.slice(0, 6))).toEqual(new Set([0]));
    expect(new Set(labels.slice(6, 12))).toEqual(new Set([1]));
    expect(labels[12]).toBe(NOISE);
  });

  test("a group smaller than minPoints is all noise", () => {
    expect(dbscan(group(5.41, 100.33, 3), { epsM: 60, minPoints: 6 })).toEqual([-1, -1, -1]);
  });

  test("a long food street (a chain of places) stays one cluster", () => {
    // 20 places 11 m apart in a line: about 210 m long, longer than epsM.
    expect(new Set(dbscan(group(5.41, 100.33, 20), { epsM: 60, minPoints: 6 }))).toEqual(
      new Set([0]),
    );
  });
});

describe("findFoodClusters", () => {
  test("describes each cluster and applies the hidden gem rule to the whole area", () => {
    const gems = group(5.43, 100.31, 6, { area: "Pulau Tikus" }).map((p, k) =>
      k < 3 ? { ...p, avgRating: 4.6, reviewCount: 30 + k, label: "Hidden Gem" } : p,
    );
    const famous = group(5.41, 100.33, 8, { area: "George Town" }).map((p, k) =>
      k < 2 ? { ...p, avgRating: 4.4, reviewCount: 2000, label: "Popular" } : p,
    );
    const result = findFoodClusters(
      [...gems, ...famous, { id: "x", lat: 5.3, lng: 100.2 }],
      thresholds,
      {
        epsM: 60,
        minPoints: 6,
      },
    );
    expect(result.noisePlaces).toBe(1);
    expect(result.settings).toEqual({ epsM: 60, minPoints: 6 });
    const [big, small] = result.clusters; // biggest first
    expect(big).toMatchObject({ id: 1, places: 8, area: "George Town", isHiddenGemArea: false });
    expect(small).toMatchObject({
      id: 2,
      places: 6,
      area: "Pulau Tikus",
      ratedPlaces: 3,
      averageRating: 4.6,
      medianReviews: 31,
      hiddenGems: 3,
      isHiddenGemArea: true,
    });
    expect(small.topPlaces).toHaveLength(3);
    expect(small.centre.lat).toBeCloseTo(5.43025, 4);

    const findings = describeFoodClusters(result);
    expect(findings[0]).toMatch(/found 2 food clusters/);
    expect(findings[1]).toMatch(/Pulau Tikus \(6 places\) is a hidden gem area/);
  });

  test("no clusters -> no findings", () => {
    const result = findFoodClusters(group(5.41, 100.33, 2), thresholds);
    expect(result.clusters).toEqual([]);
    expect(describeFoodClusters(result)).toEqual([]);
  });
});
