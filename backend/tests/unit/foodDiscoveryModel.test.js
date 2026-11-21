jest.mock("../../src/lib/db", () => ({ query: jest.fn() }));
const db = require("../../src/lib/db");
const {
  findFoodPlacesNearby,
  findFoodPlaceById,
  escapeLikePattern,
  cuisinePatterns,
} = require("../../src/modules/food-discovery/model");

afterEach(() => jest.clearAllMocks());

describe("cuisine pattern escaping", () => {
  test("escapes %, _ and backslash so they match literally", () => {
    expect(escapeLikePattern("50%_off\\")).toBe("50\\%\\_off\\\\");
    expect(escapeLikePattern("nasi kandar")).toBe("nasi kandar");
  });

  test("wraps each word as a 'contains' pattern", () => {
    expect(cuisinePatterns(["chinese", "a%b"])).toEqual(["%chinese%", "%a\\%b%"]);
  });
});

describe("findFoodPlacesNearby", () => {
  test("sends values as parameters, never inside the SQL text", async () => {
    db.query.mockResolvedValue({ rows: [{ id: "x" }] });
    const rows = await findFoodPlacesNearby({
      lat: 5.4145,
      lng: 100.3292,
      radius: 1500,
      halal: true,
      maxPrice: 2,
      cuisines: ["chinese'; drop table places; --"],
      dietary: ["vegan"],
    });
    expect(rows).toEqual([{ id: "x" }]);
    const [sql, params] = db.query.mock.calls[0];
    expect(params).toEqual([
      5.4145,
      100.3292,
      1500,
      true,
      2,
      ["%chinese'; drop table places; --%"],
      ["vegan"],
    ]);
    expect(sql).not.toMatch(/drop table|chinese|5\.4145/);
    expect(sql).toMatch(/st_dwithin/);
    expect(sql).toMatch(/ilike any/);
  });

  test("unset filters become null / false (filter switched off)", async () => {
    db.query.mockResolvedValue({ rows: [] });
    await findFoodPlacesNearby({ lat: 1, lng: 2, radius: 100, cuisines: [], dietary: undefined });
    expect(db.query.mock.calls[0][1]).toEqual([1, 2, 100, false, null, null, null]);
  });
});

describe("findFoodPlaceById", () => {
  test("returns the row or null", async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: "a" }] });
    expect(await findFoodPlaceById("a")).toEqual({ id: "a" });
    expect(db.query.mock.calls[0][1]).toEqual(["a"]);
    db.query.mockResolvedValueOnce({ rows: [] });
    expect(await findFoodPlaceById("b")).toBeNull();
  });
});
