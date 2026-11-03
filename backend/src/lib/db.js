// Shared PostgreSQL connection pool (plain SQL through the `pg` library).
// The pool is created on first use, so code that never touches the database
// (e.g. unit tests) does not need DATABASE_URL.

const { Pool } = require("pg");
const config = require("../config");

let pool = null;

// URL.hostname keeps the brackets around IPv6 addresses, hence "[::1]".
const LOCAL_HOSTS = ["localhost", "127.0.0.1", "[::1]"];

// Parses DATABASE_URL. The error never contains the URL, because it holds the password.
function parseDatabaseUrl(databaseUrl) {
  try {
    return new URL(databaseUrl);
  } catch {
    throw new Error("DATABASE_URL is not a valid URL");
  }
}

// setting: "require" | "disable" | undefined (DATABASE_SSL in .env).
// When not set: a local database (laptop or CI) usually has no SSL, so "disable";
// anything else (Supabase) only accepts encrypted connections, so "require".
function sslOptionsFor(databaseUrl, setting) {
  const host = parseDatabaseUrl(databaseUrl).hostname;
  const mode = setting || (LOCAL_HOSTS.includes(host) ? "disable" : "require");
  if (mode === "disable") return false;
  // Encrypted, but the server certificate is not checked because Supabase's CA
  // certificate is not in Node's default trust store. It can be added later with
  // { ca: <Supabase CA cert>, rejectUnauthorized: true } for full verification.
  return { rejectUnauthorized: false };
}

// pg reads ?sslmode=... from the connection string and that would override our
// `ssl` option, so it is removed; DATABASE_SSL decides instead.
function connectionStringFor(databaseUrl) {
  const url = parseDatabaseUrl(databaseUrl);
  if (!url.searchParams.has("sslmode")) return databaseUrl;
  url.searchParams.delete("sslmode");
  return url.toString();
}

function getPool() {
  if (!pool) {
    if (!config.databaseUrl) {
      throw new Error("DATABASE_URL is not set in backend/.env (see backend/.env.example).");
    }
    pool = new Pool({
      connectionString: connectionStringFor(config.databaseUrl),
      ssl: sslOptionsFor(config.databaseUrl, config.databaseSsl),
      max: 5,
    });
    // An idle client losing its connection must not crash the whole server.
    pool.on("error", (err) => console.error("PostgreSQL pool error:", err.message));
  }
  return pool;
}

function query(text, params) {
  return getPool().query(text, params);
}

async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = {
  query,
  getPool,
  closePool,
  sslOptionsFor,
  connectionStringFor,
  // `pool` is read lazily so requiring this file never opens a connection.
  get pool() {
    return getPool();
  },
};
