const { loadConfig } = require("../../src/config/loadConfig");

const VALID = {
  NODE_ENV: "development",
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "publishable-key",
};

describe("loadConfig", () => {
  test("lists every missing value and points to .env.example", () => {
    expect(() => loadConfig({ NODE_ENV: "development" })).toThrow(/SUPABASE_URL/);
    expect(() => loadConfig({ NODE_ENV: "development" })).toThrow(/SUPABASE_PUBLISHABLE_KEY/);
    expect(() => loadConfig({ NODE_ENV: "development" })).toThrow(/\.env\.example/);
  });

  test("rejects an invalid value", () => {
    expect(() => loadConfig({ ...VALID, PORT: "not-a-number" })).toThrow(/PORT/);
    expect(() => loadConfig({ ...VALID, SUPABASE_URL: "not a url" })).toThrow(/SUPABASE_URL/);
  });

  test("applies defaults and converts types", () => {
    const config = loadConfig(VALID);
    expect(config.port).toBe(3000);
    expect(config.hiddenGem).toEqual({ minRating: 4.3, maxReviews: 100 });
    expect(config.corsOrigins).toEqual(["http://localhost:5173", "http://localhost:8081"]);
    expect(config.databaseUrl).toBeUndefined();
  });

  test("reads custom values", () => {
    const config = loadConfig({
      ...VALID,
      PORT: "4000",
      HIDDEN_GEM_MIN_RATING: "4.5",
      HIDDEN_GEM_MAX_REVIEWS: "50",
      CORS_ORIGINS: " http://a.test , http://b.test ",
      DATABASE_URL: "postgresql://u:p@localhost:5432/db",
    });
    expect(config.port).toBe(4000);
    expect(config.hiddenGem).toEqual({ minRating: 4.5, maxReviews: 50 });
    expect(config.corsOrigins).toEqual(["http://a.test", "http://b.test"]);
    expect(config.databaseUrl).toBe("postgresql://u:p@localhost:5432/db");
  });

  test("treats an empty DATABASE_URL as not set", () => {
    expect(loadConfig({ ...VALID, DATABASE_URL: "" }).databaseUrl).toBeUndefined();
  });

  test("in test mode, works without any .env values", () => {
    const config = loadConfig({ NODE_ENV: "test" });
    expect(config.env).toBe("test");
    expect(config.supabase.url).toMatch(/^https:\/\//);
  });

  test("returns a frozen object", () => {
    const config = loadConfig(VALID);
    expect(Object.isFrozen(config)).toBe(true);
    expect(Object.isFrozen(config.hiddenGem)).toBe(true);
  });
});

describe("loadConfig fail-fast outside test mode", () => {
  test("production does not get the test placeholders and lists every missing value", () => {
    let message;
    try {
      loadConfig({ NODE_ENV: "production" });
    } catch (err) {
      message = err.message;
    }
    expect(message).toMatch(/SUPABASE_URL: missing/);
    expect(message).toMatch(/SUPABASE_PUBLISHABLE_KEY: missing/);
  });

  test("an empty required value is rejected, not accepted", () => {
    expect(() => loadConfig({ ...VALID, SUPABASE_PUBLISHABLE_KEY: "" })).toThrow(
      /SUPABASE_PUBLISHABLE_KEY/,
    );
  });

  test("an unknown NODE_ENV is rejected", () => {
    expect(() => loadConfig({ ...VALID, NODE_ENV: "staging" })).toThrow(/NODE_ENV/);
  });

  test("PORT outside 1-65535 is rejected", () => {
    expect(() => loadConfig({ ...VALID, PORT: "0" })).toThrow(/PORT/);
    expect(() => loadConfig({ ...VALID, PORT: "70000" })).toThrow(/PORT/);
  });
});

describe("loadConfig hidden gem thresholds", () => {
  test("accepts the edges of the allowed range", () => {
    expect(loadConfig({ ...VALID, HIDDEN_GEM_MIN_RATING: "0" }).hiddenGem.minRating).toBe(0);
    expect(loadConfig({ ...VALID, HIDDEN_GEM_MIN_RATING: "5" }).hiddenGem.minRating).toBe(5);
    expect(loadConfig({ ...VALID, HIDDEN_GEM_MAX_REVIEWS: "0" }).hiddenGem.maxReviews).toBe(0);
  });

  test("rejects a minimum rating outside 0-5 or not a number", () => {
    for (const bad of ["5.1", "-1", "abc"]) {
      expect(() => loadConfig({ ...VALID, HIDDEN_GEM_MIN_RATING: bad })).toThrow(
        /HIDDEN_GEM_MIN_RATING/,
      );
    }
  });

  test("rejects a negative or fractional maximum review count", () => {
    for (const bad of ["-1", "10.5"]) {
      expect(() => loadConfig({ ...VALID, HIDDEN_GEM_MAX_REVIEWS: bad })).toThrow(
        /HIDDEN_GEM_MAX_REVIEWS/,
      );
    }
  });

  // An empty HIDDEN_GEM_MIN_RATING= line must not silently become 0.
  test("an empty threshold uses the default instead of 0", () => {
    const config = loadConfig({ ...VALID, HIDDEN_GEM_MIN_RATING: "", HIDDEN_GEM_MAX_REVIEWS: "" });
    expect(config.hiddenGem).toEqual({ minRating: 4.3, maxReviews: 100 });
  });
});
