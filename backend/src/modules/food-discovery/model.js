// Food Place Searching: SQL queries for places. Parameterised only ($1, $2, ...),
// never values joined into the SQL text.

const db = require("../../lib/db");

// Columns returned for one place. avg_rating is cast to float8 because pg returns
// "numeric" as a string.
const PLACE_COLUMNS = `
  p.id, p.name, p.cuisine, p.area, p.address, p.is_halal, p.price_level,
  p.avg_rating::float8 as avg_rating, p.review_count, p.dietary, p.opening_hours, p.is_sample,
  st_y(p.location::geometry) as lat,
  st_x(p.location::geometry) as lng`;

// Escapes the ILIKE wildcards % and _ (and the escape character \ itself), so a
// cuisine search for "50%" means the text "50%", not "50 followed by anything".
function escapeLikePattern(text) {
  return text.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

// "chinese" -> "%chinese%" (contains, case-insensitive with ILIKE).
function cuisinePatterns(cuisines) {
  return cuisines.map((c) => `%${escapeLikePattern(c)}%`);
}

// Places within `radius` metres of (lat, lng), nearest first, with the SQL-side filters.
// filters: { lat, lng, radius, halal?, maxPrice?, cuisines?: string[], dietary?: string[] }
// A null parameter switches its filter off.
//   halal = true  -> only places marked halal (unknown halal is left out).
//   maxPrice      -> price_level <= maxPrice (unknown price is left out).
//   cuisines      -> cuisine contains ANY of the words.
//   dietary       -> place.dietary contains ALL of the tags.
async function findFoodPlacesNearby(filters) {
  const { lat, lng, radius, halal, maxPrice, cuisines, dietary } = filters;
  const sql = `
    select ${PLACE_COLUMNS},
      st_distance(p.location, st_point($2::float8, $1::float8)::geography) as distance_m
    from places p
    where st_dwithin(p.location, st_point($2::float8, $1::float8)::geography, $3::float8)
      and ($4::boolean is not true or p.is_halal is true)
      and ($5::smallint is null or p.price_level <= $5::smallint)
      and ($6::text[] is null or p.cuisine ilike any ($6::text[]))
      and ($7::text[] is null or p.dietary @> $7::text[])
    order by distance_m`;
  const params = [
    lat,
    lng,
    radius,
    halal === true,
    maxPrice ?? null,
    cuisines && cuisines.length > 0 ? cuisinePatterns(cuisines) : null,
    dietary && dietary.length > 0 ? dietary : null,
  ];
  const { rows } = await db.query(sql, params);
  return rows;
}

// One place by id, or null when it does not exist.
async function findFoodPlaceById(id) {
  const { rows } = await db.query(`select ${PLACE_COLUMNS} from places p where p.id = $1`, [id]);
  return rows[0] ?? null;
}

module.exports = { findFoodPlacesNearby, findFoodPlaceById, escapeLikePattern, cuisinePatterns };
