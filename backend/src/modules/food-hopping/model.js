// Route Planner: SQL queries for the places used in a route.

const db = require("../../lib/db");

// Fetches the given places by id (parameterised, never string-joined).
// Places that do not exist are simply not returned; the service reports them.
async function findPlacesForRoute(placeIds) {
  const { rows } = await db.query(
    `select id, name,
            st_y(location::geometry) as lat,
            st_x(location::geometry) as lng,
            cuisine, avg_rating, review_count, is_sample
       from places
      where id = any($1::uuid[])`,
    [placeIds],
  );
  return rows.map((r) => ({
    ...r,
    // numeric columns arrive as strings from pg; convert for the JSON response.
    avg_rating: r.avg_rating == null ? null : Number(r.avg_rating),
  }));
}

module.exports = { findPlacesForRoute };
