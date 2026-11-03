// Review fixes D (rollback does not mask the error), H (one decimal rating), I (keep OSM hours).
const fs = require("fs");
const os = require("os");
const path = require("path");
const { runMigrations } = require("../../db/migrate");
const { seedSamplePlaces, samplePlaceSchema, loadSamplePlaces } = require("../../db/seeds/seed");

// Fails on the query containing `failOn`, and the rollback fails too.
function clientWithBrokenRollback(failOn) {
  return {
    async query(text) {
      if (text.trim() === "rollback") throw new Error("connection lost during rollback");
      if (text.includes(failOn)) throw new Error("original failure");
      return { rows: [] };
    },
  };
}

let errorSpy;
beforeEach(() => {
  errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => errorSpy.mockRestore());

describe("D: a failing rollback does not hide the original error", () => {
  test("migrate", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mmr-mig-"));
    fs.writeFileSync(path.join(dir, "001_bad.sql"), "create table bad_table ();");
    try {
      await expect(
        runMigrations(clientWithBrokenRollback("bad_table"), { dir, log: () => {} }),
      ).rejects.toThrow(/001_bad.sql failed and was rolled back: original failure/);
      expect(errorSpy).toHaveBeenCalledWith(expect.any(String), "connection lost during rollback");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test("seed", async () => {
    const places = loadSamplePlaces().slice(0, 1);
    await expect(
      seedSamplePlaces(clientWithBrokenRollback("insert into places"), places),
    ).rejects.toThrow("original failure");
  });
});

describe("H: avg_rating has at most one decimal place", () => {
  const base = loadSamplePlaces()[0];

  test.each([4.3, 0.7, 5, 0])("accepts %p", (rating) => {
    expect(samplePlaceSchema.safeParse({ ...base, avg_rating: rating }).success).toBe(true);
  });

  test.each([4.35, 3.21])("rejects %p", (rating) => {
    const result = samplePlaceSchema.safeParse({ ...base, avg_rating: rating });
    expect(result.success).toBe(false);
    expect(result.error.issues[0].message).toMatch(/one decimal place/);
  });
});

describe("I: converting an OSM row to sample keeps its OSM opening-hours string", () => {
  test("the upsert merges the existing osm key into the new opening_hours", async () => {
    const texts = [];
    const client = {
      async query(text) {
        texts.push(text);
        return { rows: [] };
      },
    };
    await seedSamplePlaces(client, loadSamplePlaces().slice(0, 1));
    const upsert = texts.find((t) => t.includes("on conflict"));
    expect(upsert).toMatch(
      /opening_hours = excluded\.opening_hours\s*\|\|\s*jsonb_strip_nulls\(jsonb_build_object\('osm', places\.opening_hours -> 'osm'\)\)/,
    );
  });
});
