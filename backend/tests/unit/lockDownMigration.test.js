// Static checks for 004_lock_down_public_api.sql (Supabase REST API lock-down).
const fs = require("fs");
const path = require("path");

const sql = fs
  .readFileSync(
    path.join(__dirname, "..", "..", "db", "migrations", "004_lock_down_public_api.sql"),
    "utf8",
  )
  // Ignore comments and collapse whitespace so the checks look at real statements only.
  .replace(/--.*$/gm, "")
  .replace(/\s+/g, " ")
  .toLowerCase();

test("only runs where the Supabase roles exist (no-op on plain PostgreSQL)", () => {
  expect(sql).toMatch(
    /^ ?do \$\$ begin if exists \(select 1 from pg_roles where rolname = 'anon'\)/,
  );
  expect(sql).toMatch(/exists \(select 1 from pg_roles where rolname = 'authenticated'\)/);
  // Every revoke is inside the guarded block.
  const blockEnd = sql.indexOf("end if;");
  expect(sql.lastIndexOf("revoke")).toBeLessThan(blockEnd);
});

test("removes all access to spatial_ref_sys", () => {
  expect(sql).toMatch(/revoke all on table spatial_ref_sys from anon, authenticated;/);
});

test("removes all access to the five private tables", () => {
  const match = sql.match(/revoke all on table ([a-z_, ]+) from anon, authenticated;/g).join(" ");
  for (const table of [
    "profiles",
    "preferences",
    "itineraries",
    "itinerary_stops",
    "schema_migrations",
  ]) {
    expect(match).toContain(table);
  }
});

test("places keeps SELECT but loses every write privilege", () => {
  expect(sql).toMatch(
    /revoke insert, update, delete, truncate, references, trigger on table places from anon, authenticated;/,
  );
  expect(sql).not.toMatch(/revoke all on table[^;]*\bplaces\b/);
  expect(sql).not.toMatch(/revoke select/);
});

test("nearby_places cannot be executed through the REST API", () => {
  expect(sql).toMatch(
    /revoke execute on function nearby_places\(double precision, double precision, double precision\) from public, anon, authenticated;/,
  );
});

test("future tables, functions and sequences get no default grants", () => {
  for (const kind of ["tables", "functions", "sequences"]) {
    expect(sql).toContain(
      `alter default privileges in schema public revoke all on ${kind} from anon, authenticated;`,
    );
  }
  expect(sql).toContain("alter default privileges revoke execute on functions from public;");
});
