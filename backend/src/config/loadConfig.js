// Validates environment variables and builds the frozen config object.
// Kept free of side effects (no .env reading) so it is easy to unit test.

const { z } = require("zod");

// Checks the URL shape without ever putting the value (which holds the database
// password) into an error message.
function isPostgresUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "postgresql:" || url.protocol === "postgres:";
  } catch {
    return false;
  }
}

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  // Optional at load time: only code that actually queries the database needs it (see lib/db.js).
  DATABASE_URL: z
    .string()
    .refine(isPostgresUrl, { message: "must be a valid postgresql:// connection string" })
    .optional(),
  // "require" (encrypted) or "disable". When not set, lib/db.js picks by host.
  DATABASE_SSL: z.enum(["require", "disable"]).optional(),
  SUPABASE_URL: z.string().url(),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  HIDDEN_GEM_MIN_RATING: z.coerce.number().min(0).max(5).default(4.3),
  HIDDEN_GEM_MAX_REVIEWS: z.coerce.number().int().min(0).default(100),
  // "Popular" label: places with MORE than this many reviews.
  POPULAR_MIN_REVIEWS: z.coerce.number().int().min(0).default(100),
  CORS_ORIGINS: z.string().default("http://localhost:5173,http://localhost:8081"),
});

// Safe placeholder values so unit tests run without a .env file.
const TEST_DEFAULTS = {
  SUPABASE_URL: "https://test-project.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "test-publishable-key",
};

// An empty line like "PORT=" in .env means "not set", so the default applies.
// (Without this, z.coerce.number() would quietly turn "" into 0.)
function dropEmptyValues(env) {
  const out = {};
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === "string" && value.trim() === "") continue;
    out[key] = value;
  }
  return out;
}

function loadConfig(env) {
  let input = dropEmptyValues(env);
  if (input.NODE_ENV === "test") {
    // Tests must never touch a real database by accident: only TEST_DATABASE_URL counts.
    const testDatabaseUrl = input.TEST_DATABASE_URL;
    input = { ...TEST_DEFAULTS, ...input };
    delete input.DATABASE_URL;
    delete input.TEST_DATABASE_URL;
    if (testDatabaseUrl) input.DATABASE_URL = testDatabaseUrl;
  }

  const result = envSchema.safeParse(input);

  if (!result.success) {
    const problems = result.error.issues.map((i) => {
      const name = i.path.join(".");
      // Say "missing" rather than zod's generic type message when a value is not set at all.
      return `  - ${name}: ${input[name] == null ? "missing" : i.message}`;
    });
    throw new Error(
      `Invalid or missing settings in backend/.env:\n${problems.join("\n")}\n` +
        "Copy backend/.env.example to backend/.env and fill in the values.",
    );
  }

  const e = result.data;
  return Object.freeze({
    env: e.NODE_ENV,
    port: e.PORT,
    databaseUrl: e.DATABASE_URL,
    databaseSsl: e.DATABASE_SSL,
    supabase: Object.freeze({ url: e.SUPABASE_URL, publishableKey: e.SUPABASE_PUBLISHABLE_KEY }),
    hiddenGem: Object.freeze({
      minRating: e.HIDDEN_GEM_MIN_RATING,
      maxReviews: e.HIDDEN_GEM_MAX_REVIEWS,
      popularMinReviews: e.POPULAR_MIN_REVIEWS,
    }),
    corsOrigins: Object.freeze(
      e.CORS_ORIGINS.split(",")
        .map((o) => o.trim())
        .filter(Boolean),
    ),
  });
}

module.exports = { loadConfig };
