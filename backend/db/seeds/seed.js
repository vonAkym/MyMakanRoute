// Loads the SAMPLE places (sample-places.json) into the places table.
// Names and coordinates are real (OpenStreetMap); ratings, review counts, prices,
// halal flags and opening hours are INVENTED for testing. Rows get source='sample'
// and is_sample=true so they can always be told apart from real data.
// Usage: npm run db:seed   (run npm run db:migrate first)

const path = require("path");
const { z } = require("zod");

const SEED_FILE = path.join(__dirname, "sample-places.json");

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "time must be HH:MM");

// {"mon":[["08:00","15:00"]], ..., "osm": "<original OSM string>"}
const openingHoursSchema = z
  .object({
    ...Object.fromEntries(DAYS.map((d) => [d, z.array(z.tuple([time, time])).optional()])),
    osm: z.string().optional(),
  })
  .strict();

const samplePlaceSchema = z.object({
  osm_id: z.string().regex(/^(node|way|relation)\/\d+$/),
  name: z.string().min(1),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  cuisine: z.string().min(1),
  area: z.string().min(1),
  is_halal: z.boolean(),
  price_level: z.number().int().min(1).max(4),
  avg_rating: z
    .number()
    .min(0)
    .max(5)
    // The column is numeric(2,1): at most one decimal place (4.3, not 4.35).
    .refine((v) => Math.abs(v * 10 - Math.round(v * 10)) < 1e-9, {
      message: "avg_rating must have at most one decimal place",
    }),
  review_count: z.number().int().min(0),
  dietary: z.array(z.enum(["vegetarian", "vegan"])),
  opening_hours: openingHoursSchema,
});

const seedFileSchema = z.object({
  _note: z.string().includes("SAMPLE DATA"),
  places: z.array(samplePlaceSchema).min(1),
});

// Reads and validates the seed file; throws with the first problems if it is wrong.
function loadSamplePlaces(file = SEED_FILE) {
  const raw = require(file);
  const result = seedFileSchema.safeParse(raw);
  if (!result.success) {
    const problems = result.error.issues
      .slice(0, 5)
      .map((i) => `${i.path.join(".")}: ${i.message}`);
    throw new Error(`Invalid seed file ${file}:\n  ${problems.join("\n  ")}`);
  }
  return result.data.places;
}

// If the same OSM place was already imported by import-osm.js, it is turned into a
// sample row and its invented fields are filled in (one row per place, no duplicates).
const UPSERT_SQL = `
  insert into places (
    osm_id, name, location, cuisine, area, is_halal, price_level,
    avg_rating, review_count, dietary, opening_hours, source, is_sample
  ) values (
    $1, $2, st_setsrid(st_makepoint($3, $4), 4326)::geography, $5, $6, $7, $8,
    $9, $10, $11, $12::jsonb, 'sample', true
  )
  on conflict (osm_id) do update set
    name = excluded.name,
    location = excluded.location,
    cuisine = excluded.cuisine,
    area = excluded.area,
    is_halal = excluded.is_halal,
    price_level = excluded.price_level,
    avg_rating = excluded.avg_rating,
    review_count = excluded.review_count,
    dietary = excluded.dietary,
    -- Keep the original OSM opening-hours string ("osm" key) of an imported row.
    opening_hours = excluded.opening_hours
      || jsonb_strip_nulls(jsonb_build_object('osm', places.opening_hours -> 'osm')),
    source = 'sample',
    is_sample = true
`;

// Rolls back without hiding the original error if the rollback itself fails.
async function rollbackQuietly(client) {
  try {
    await client.query("rollback");
  } catch (err) {
    console.error("Rollback also failed:", err.message);
  }
}

// `client` is a connected pg client. Runs in one transaction: all rows or none.
async function seedSamplePlaces(client, places) {
  await client.query("begin");
  try {
    for (const p of places) {
      await client.query(UPSERT_SQL, [
        p.osm_id,
        p.name,
        p.lng,
        p.lat,
        p.cuisine,
        p.area,
        p.is_halal,
        p.price_level,
        p.avg_rating,
        p.review_count,
        p.dietary,
        JSON.stringify(p.opening_hours),
      ]);
    }
    await client.query("commit");
  } catch (err) {
    await rollbackQuietly(client);
    throw err;
  }
  return places.length;
}

async function main() {
  const db = require("../../src/lib/db");
  const places = loadSamplePlaces();
  const client = await db.getPool().connect();
  try {
    const count = await seedSamplePlaces(client, places);
    console.log(`Seeded ${count} SAMPLE places (source='sample', is_sample=true).`);
  } finally {
    client.release();
    await db.closePool();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}

module.exports = { loadSamplePlaces, seedSamplePlaces, samplePlaceSchema };
