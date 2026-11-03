// Imports food places from OpenStreetMap (Overpass API) into the places table.
// Usage: npm run import:osm
// Data © OpenStreetMap contributors, ODbL.

const fs = require("fs");
const path = require("path");
const db = require("../src/lib/db");

// south, west, north, east: Gelugor/USM up to George Town
const BBOX = [5.33, 100.27, 5.46, 100.345];
const SERVERS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];
const SNAPSHOT = path.join(__dirname, "..", "..", "data", "osm-penang.json");
const BATCH_SIZE = 500;

const query = `[out:json][timeout:60];
nwr["amenity"~"^(restaurant|fast_food|food_court|cafe)$"](${BBOX.join(",")});
out center tags;`;

async function fetchOverpass() {
  for (let attempt = 0; attempt < 3; attempt++) {
    for (const url of SERVERS) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "MyMakanRoute-FYP/0.1",
          },
          body: new URLSearchParams({ data: query }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        console.log(`Fetched ${json.elements.length} elements from ${url}`);
        return json.elements;
      } catch (err) {
        console.warn(`Overpass failed (${url}): ${err.message}`);
      }
    }
    const wait = 10000 * 2 ** attempt;
    console.log(`All servers busy, retrying in ${wait / 1000}s...`);
    await new Promise((r) => setTimeout(r, wait));
  }
  throw new Error("Overpass API unavailable, try again later");
}

function toHalal(tags) {
  const v = tags["diet:halal"];
  if (v === "yes" || v === "only") return true;
  if (v === "no") return false;
  return null;
}

function toAddress(tags) {
  const parts = [
    [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" "),
    tags["addr:postcode"],
    tags["addr:city"],
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

function toPlace(el) {
  const tags = el.tags || {};
  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  if (!tags.name || lat == null || lng == null) return null;

  return {
    osm_id: `${el.type}/${el.id}`,
    name: tags.name,
    cuisine: tags.cuisine
      ? tags.cuisine
          .split(";")
          .map((c) => c.trim())
          .join(", ")
      : null,
    address: toAddress(tags),
    area: tags["addr:suburb"] || tags["addr:city"] || null,
    lat,
    lng,
    is_halal: toHalal(tags),
    opening_hours: tags.opening_hours ? { osm: tags.opening_hours } : null,
  };
}

const COLUMNS_PER_ROW = 9;

// Builds one multi-row upsert. Rows that are SAMPLE data (is_sample = true) are never
// updated, so their invented ratings, prices and hours are kept.
function buildUpsert(places) {
  const values = [];
  const params = [];
  places.forEach((p, i) => {
    const b = i * COLUMNS_PER_ROW;
    values.push(
      `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, ` +
        `st_setsrid(st_makepoint($${b + 6}, $${b + 7}), 4326)::geography, ` +
        `$${b + 8}, $${b + 9}::jsonb, 'osm')`,
    );
    params.push(
      p.osm_id,
      p.name,
      p.cuisine,
      p.address,
      p.area,
      p.lng,
      p.lat,
      p.is_halal,
      p.opening_hours ? JSON.stringify(p.opening_hours) : null,
    );
  });

  const text = `
    insert into places (osm_id, name, cuisine, address, area, location, is_halal, opening_hours, source)
    values ${values.join(",\n")}
    on conflict (osm_id) do update set
      name = excluded.name,
      cuisine = excluded.cuisine,
      address = excluded.address,
      area = excluded.area,
      location = excluded.location,
      is_halal = excluded.is_halal,
      opening_hours = excluded.opening_hours,
      source = excluded.source
    where places.is_sample = false`;
  return { text, params };
}

async function main() {
  const elements = await fetchOverpass();
  fs.writeFileSync(SNAPSHOT, JSON.stringify(elements, null, 2));
  console.log(`Saved raw snapshot to ${path.relative(process.cwd(), SNAPSHOT)}`);

  const places = elements.map(toPlace).filter(Boolean);
  console.log(`${places.length} named places to import`);

  try {
    for (let i = 0; i < places.length; i += BATCH_SIZE) {
      const { text, params } = buildUpsert(places.slice(i, i + BATCH_SIZE));
      await db.query(text, params);
      console.log(`Imported ${Math.min(i + BATCH_SIZE, places.length)}/${places.length}`);
    }
  } finally {
    await db.closePool();
  }

  console.log("Done.");
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}

module.exports = { toPlace, buildUpsert };
