// Tiny migration runner.
// Applies backend/db/migrations/*.sql in name order. Each file runs once, inside a
// transaction, and is recorded in schema_migrations, so a second run applies nothing.
// Usage: npm run db:migrate

const fs = require("fs");
const path = require("path");

const MIGRATIONS_DIR = path.join(__dirname, "migrations");

const CREATE_TABLE_SQL = `
  create table if not exists schema_migrations (
    name       text primary key,
    applied_at timestamptz not null default now()
  );
  -- Hide this table from Supabase's public REST API (the backend is the table owner).
  alter table schema_migrations enable row level security;
`;

// Rolls back without hiding the original error if the rollback itself fails
// (e.g. the connection already dropped).
async function rollbackQuietly(client) {
  try {
    await client.query("rollback");
  } catch (err) {
    console.error("Rollback also failed:", err.message);
  }
}

// Migration files sorted by name, e.g. ["001_places.sql", "002_users.sql"].
function listMigrationFiles(dir = MIGRATIONS_DIR) {
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

// `client` is a connected pg client (or anything with the same query() method).
// Returns the names of the files applied in this run.
async function runMigrations(client, { dir = MIGRATIONS_DIR, log = console.log } = {}) {
  await client.query(CREATE_TABLE_SQL);
  const { rows } = await client.query("select name from schema_migrations");
  const done = new Set(rows.map((r) => r.name));

  const applied = [];
  for (const file of listMigrationFiles(dir)) {
    if (done.has(file)) continue;
    const sql = fs.readFileSync(path.join(dir, file), "utf8");
    try {
      await client.query("begin");
      await client.query(sql);
      await client.query("insert into schema_migrations (name) values ($1)", [file]);
      await client.query("commit");
    } catch (err) {
      await rollbackQuietly(client);
      throw new Error(`Migration ${file} failed and was rolled back: ${err.message}`);
    }
    log(`Applied ${file}`);
    applied.push(file);
  }

  if (applied.length === 0) log("Nothing to apply: database is up to date.");
  return applied;
}

async function main() {
  const db = require("../src/lib/db");
  const client = await db.getPool().connect();
  try {
    await runMigrations(client);
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

module.exports = { listMigrationFiles, runMigrations };
