// Review fixes A, B, C, F, J for loadConfig.
const { loadConfig } = require("../../src/config/loadConfig");

const VALID = {
  NODE_ENV: "development",
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "publishable-key",
};

function errorMessage(fn) {
  try {
    fn();
  } catch (err) {
    return err.message;
  }
  throw new Error("expected loadConfig to throw");
}

describe("A: empty numbers use their defaults", () => {
  test("PORT= gives 3000, not 0", () => {
    expect(loadConfig({ ...VALID, PORT: "" }).port).toBe(3000);
  });

  test("whitespace-only thresholds count as empty", () => {
    const config = loadConfig({
      ...VALID,
      HIDDEN_GEM_MIN_RATING: "  ",
      HIDDEN_GEM_MAX_REVIEWS: " ",
    });
    expect(config.hiddenGem).toEqual({ minRating: 4.3, maxReviews: 100, popularMinReviews: 100 });
  });
});

describe("B: other empty values", () => {
  test("CORS_ORIGINS= uses the default origins instead of none", () => {
    expect(loadConfig({ ...VALID, CORS_ORIGINS: "" }).corsOrigins).toEqual([
      "http://localhost:5173",
      "http://localhost:8081",
    ]);
  });

  test("SUPABASE_URL= is reported as missing, not as an invalid URL", () => {
    const message = errorMessage(() => loadConfig({ ...VALID, SUPABASE_URL: "" }));
    expect(message).toMatch(/SUPABASE_URL: missing/);
    expect(message).not.toMatch(/Invalid URL/i);
  });
});

describe("C: a malformed DATABASE_URL never shows the password", () => {
  const SECRET = "SuperSecretPw123";

  test.each([
    `postgresql://postgres:${SECRET}@[bad host:5432/postgres`,
    `not-a-url-${SECRET}`,
    `mysql://u:${SECRET}@localhost/db`,
  ])("rejects %#", (bad) => {
    const message = errorMessage(() => loadConfig({ ...VALID, DATABASE_URL: bad }));
    expect(message).toMatch(/DATABASE_URL/);
    expect(message).not.toContain(SECRET);
  });

  test("accepts postgres:// and postgresql:// URLs", () => {
    expect(loadConfig({ ...VALID, DATABASE_URL: "postgres://u:p@h:5432/d" }).databaseUrl).toBe(
      "postgres://u:p@h:5432/d",
    );
  });
});

describe("F: DATABASE_SSL", () => {
  test("is optional", () => {
    expect(loadConfig(VALID).databaseSsl).toBeUndefined();
  });

  test("accepts require and disable", () => {
    expect(loadConfig({ ...VALID, DATABASE_SSL: "require" }).databaseSsl).toBe("require");
    expect(loadConfig({ ...VALID, DATABASE_SSL: "disable" }).databaseSsl).toBe("disable");
  });

  test("rejects other values", () => {
    expect(() => loadConfig({ ...VALID, DATABASE_SSL: "maybe" })).toThrow(/DATABASE_SSL/);
  });
});

describe("J: test mode never uses the real DATABASE_URL", () => {
  test("DATABASE_URL from the shell is ignored in tests", () => {
    const config = loadConfig({
      NODE_ENV: "test",
      DATABASE_URL: "postgresql://u:p@real-db:5432/x",
    });
    expect(config.databaseUrl).toBeUndefined();
  });

  test("TEST_DATABASE_URL is used in tests", () => {
    const config = loadConfig({
      NODE_ENV: "test",
      DATABASE_URL: "postgresql://u:p@real-db:5432/x",
      TEST_DATABASE_URL: "postgresql://u:p@localhost:5432/test",
    });
    expect(config.databaseUrl).toBe("postgresql://u:p@localhost:5432/test");
  });

  test("outside test mode TEST_DATABASE_URL is ignored", () => {
    const config = loadConfig({ ...VALID, TEST_DATABASE_URL: "postgresql://u:p@localhost/t" });
    expect(config.databaseUrl).toBeUndefined();
  });
});
