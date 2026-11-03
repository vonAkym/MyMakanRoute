const { toPlace, buildUpsert } = require("../../scripts/import-osm");

describe("import-osm toPlace", () => {
  test("maps an OSM element to a place row", () => {
    const place = toPlace({
      type: "node",
      id: 1,
      lat: 5.41,
      lon: 100.33,
      tags: {
        name: "Test Stall",
        cuisine: "malay;indian",
        "diet:halal": "yes",
        opening_hours: "24/7",
      },
    });
    expect(place).toMatchObject({
      osm_id: "node/1",
      name: "Test Stall",
      cuisine: "malay, indian",
      lat: 5.41,
      lng: 100.33,
      is_halal: true,
      opening_hours: { osm: "24/7" },
    });
  });

  test("uses the centre of ways and skips unnamed places", () => {
    const way = { type: "way", id: 2, center: { lat: 5.4, lon: 100.3 }, tags: { name: "W" } };
    expect(toPlace(way)).toMatchObject({ lat: 5.4, lng: 100.3 });
    expect(toPlace({ type: "node", id: 3, lat: 5.4, lon: 100.3, tags: {} })).toBeNull();
  });
});

describe("import-osm buildUpsert", () => {
  test("never overwrites SAMPLE rows", () => {
    const rows = [toPlace({ type: "node", id: 1, lat: 5.4, lon: 100.3, tags: { name: "A" } })];
    const { text, params } = buildUpsert(rows);
    expect(text).toMatch(/where places\.is_sample = false/);
    expect(params).toHaveLength(9);
  });
});
