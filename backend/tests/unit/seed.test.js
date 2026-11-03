const fs = require("fs");
const os = require("os");
const path = require("path");
const { loadSamplePlaces, seedSamplePlaces } = require("../../db/seeds/seed");
const rawFile = require("../../db/seeds/sample-places.json");

const places = loadSamplePlaces();
// Same rule and default thresholds as the planned Hidden Gem Highlighting submodule.
const isGemByDefaults = (p) => p.avg_rating >= 4.3 && p.review_count <= 100;

describe("sample-places.json", () => {
  test("is clearly marked as SAMPLE data with invented values", () => {
    expect(rawFile._note).toMatch(/SAMPLE DATA/);
    expect(rawFile._note).toMatch(/INVENTED/);
  });

  test("has about 50 valid places with unique OSM ids", () => {
    expect(places.length).toBeGreaterThanOrEqual(45);
    expect(places.length).toBeLessThanOrEqual(60);
    expect(new Set(places.map((p) => p.osm_id)).size).toBe(places.length);
  });

  test("all places are inside the project bounding box", () => {
    for (const p of places) {
      expect(p.lat).toBeGreaterThanOrEqual(5.33);
      expect(p.lat).toBeLessThanOrEqual(5.46);
      expect(p.lng).toBeGreaterThanOrEqual(100.27);
      expect(p.lng).toBeLessThanOrEqual(100.345);
    }
  });

  test("has a useful mix of hidden gems, popular and low-rated places", () => {
    const gems = places.filter(isGemByDefaults).length;
    const popular = places.filter((p) => p.avg_rating >= 4.3 && p.review_count > 1000).length;
    const low = places.filter((p) => p.avg_rating < 3.5).length;
    expect(gems).toBeGreaterThanOrEqual(10);
    expect(gems).toBeLessThanOrEqual(15);
    expect(popular).toBeGreaterThanOrEqual(3);
    expect(low).toBeGreaterThanOrEqual(3);
  });

  test("ratings are 0-5, price levels 1-4, review counts whole and not negative", () => {
    for (const p of places) {
      expect(p.avg_rating).toBeGreaterThanOrEqual(0);
      expect(p.avg_rating).toBeLessThanOrEqual(5);
      // avg_rating column is numeric(2,1): at most one decimal place.
      expect(Math.round(p.avg_rating * 10) / 10).toBe(p.avg_rating);
      expect([1, 2, 3, 4]).toContain(p.price_level);
      expect(Number.isInteger(p.review_count)).toBe(true);
      expect(p.review_count).toBeGreaterThanOrEqual(0);
    }
  });

  test("some places are hidden gems and some are not", () => {
    const gems = places.filter(isGemByDefaults);
    expect(gems.length).toBeGreaterThanOrEqual(10);
    expect(places.length - gems.length).toBeGreaterThanOrEqual(10);
    // Near misses that must NOT be gems: high rating but too many reviews, few reviews but low rating.
    expect(places.some((p) => p.avg_rating >= 4.3 && p.review_count > 100)).toBe(true);
    expect(places.some((p) => p.avg_rating < 4.3 && p.review_count <= 100)).toBe(true);
  });

  test("includes a place exactly on the minimum rating threshold (4.3)", () => {
    expect(places.some((p) => p.avg_rating === 4.3 && p.review_count <= 100)).toBe(true);
  });

  test("covers several areas", () => {
    const areas = new Set(places.map((p) => p.area));
    ["George Town", "Gelugor", "Air Itam", "Jelutong", "Bayan Lepas"].forEach((a) =>
      expect(areas).toContain(a),
    );
  });

  test("an invalid seed file is rejected with a clear message", () => {
    const file = path.join(os.tmpdir(), `mmr-bad-seed-${process.pid}.json`);
    fs.writeFileSync(file, JSON.stringify({ _note: "SAMPLE DATA", places: [{ name: "x" }] }));
    try {
      expect(() => loadSamplePlaces(file)).toThrow(/Invalid seed file/);
    } finally {
      fs.rmSync(file, { force: true });
    }
  });

  describe("rejects bad sample files", () => {
    const good = places[0];
    let tmpDir;
    let counter = 0;
    beforeAll(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mmr-seed-"));
    });
    afterAll(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

    // Writes `content` to a new temp file and returns a function that loads it.
    function check(content) {
      counter += 1;
      const file = path.join(tmpDir, `seed-${counter}.json`);
      fs.writeFileSync(file, JSON.stringify(content));
      return () => loadSamplePlaces(file);
    }
    const withPlace = (changes) => ({ _note: rawFile._note, places: [{ ...good, ...changes }] });

    test("a file without the SAMPLE DATA note", () => {
      expect(check({ _note: "real data", places: [good] })).toThrow(/_note/);
      expect(check({ places: [good] })).toThrow(/_note/);
    });

    test("an empty places list", () => {
      expect(check({ _note: rawFile._note, places: [] })).toThrow(/places/);
    });

    test.each([
      ["avg_rating", 5.1],
      ["avg_rating", -0.1],
      ["price_level", 0],
      ["price_level", 5],
      ["price_level", 2.5],
      ["review_count", -1],
      ["osm_id", "12345"],
      ["dietary", ["halal"]],
      ["opening_hours", { mon: [["8:00", "15:00"]] }],
      ["opening_hours", { funday: [] }],
    ])("%s = %j", (field, value) => {
      expect(check(withPlace({ [field]: value }))).toThrow(new RegExp(field));
    });

    test("the good place on its own is accepted", () => {
      expect(check(withPlace({}))()).toHaveLength(1);
    });
  });
});

describe("seedSamplePlaces", () => {
  function fakeClient(failAt = -1) {
    const calls = [];
    return {
      calls,
      async query(text, params) {
        calls.push({ text: text.trim(), params });
        if (calls.length - 1 === failAt) throw new Error("db down");
        return { rows: [] };
      },
    };
  }

  test("upserts every place as sample data inside one transaction", async () => {
    const client = fakeClient();
    const count = await seedSamplePlaces(client, places.slice(0, 2));
    expect(count).toBe(2);
    const texts = client.calls.map((c) => c.text);
    expect(texts[0]).toBe("begin");
    expect(texts[texts.length - 1]).toBe("commit");
    expect(texts[1]).toMatch(/on conflict \(osm_id\) do update/);
    expect(texts[1]).toMatch(/'sample', true/);
    // st_makepoint takes longitude first, then latitude.
    expect(client.calls[1].params.slice(2, 4)).toEqual([places[0].lng, places[0].lat]);
  });

  test("rolls back when an insert fails", async () => {
    const client = fakeClient(2);
    await expect(seedSamplePlaces(client, places.slice(0, 3))).rejects.toThrow("db down");
    expect(client.calls.map((c) => c.text)).toContain("rollback");
  });
});
