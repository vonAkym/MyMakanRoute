// Food Stalls Analytics: SQL queries. Only places WITH a rating (avg_rating is not null)
// are analysed, because the charts and the hidden gem rule need a rating.
// No user input reaches these queries; the group column is picked from a fixed list.

const db = require("../../lib/db");

// Totals over all rated places. Casts make pg return numbers, not strings.
async function summariseRatedFoodPlaces() {
  const { rows } = await db.query(`
    select count(*)::int as rated_places,
           avg(avg_rating)::float8 as average_rating,
           count(*) filter (where is_halal is true)::int as halal_places,
           count(*) filter (where is_sample is true)::int as sample_places
      from places
     where avg_rating is not null`);
  return rows[0];
}

// The only columns a chart may group by -> the SQL expression used for it.
const GROUP_COLUMNS = Object.freeze({
  area: "coalesce(nullif(trim(area), ''), 'Unknown area')",
  cuisine: "lower(coalesce(nullif(trim(cuisine), ''), 'unknown'))",
});

// Average rating and number of rated places per area or per cuisine, best first.
async function averageRatingBy(group) {
  const column = GROUP_COLUMNS[group];
  if (!column) throw new Error(`Unknown analytics group: ${group}`);
  const { rows } = await db.query(`
    select ${column} as name,
           count(*)::int as places,
           avg(avg_rating)::float8 as average_rating
      from places
     where avg_rating is not null
     group by 1
     order by average_rating desc, places desc, name`);
  return rows;
}

// Every rated place (for labels, the scatter chart and suggestions).
async function findRatedFoodPlaces() {
  const { rows } = await db.query(`
    select id, name, area, cuisine, is_halal, price_level,
           avg_rating::float8 as avg_rating, review_count, is_sample,
           st_y(location::geometry) as lat,
           st_x(location::geometry) as lng
      from places
     where avg_rating is not null
     order by avg_rating desc, review_count asc, name`);
  return rows;
}

module.exports = { summariseRatedFoodPlaces, averageRatingBy, findRatedFoodPlaces, GROUP_COLUMNS };
