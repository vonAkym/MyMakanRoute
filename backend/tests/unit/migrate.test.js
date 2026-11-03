const fs = require("fs");
const os = require("os");
const path = require("path");
const { listMigrationFiles, runMigrations } = require("../../db/migrate");

// A fake pg client that records every query and pretends `alreadyApplied` are done.
function fakeClient(alreadyApplied = [], failOn = null) {
  const calls = [];
  return {
    calls,
    async query(text, params) {
      calls.push({ text: text.trim(), params });
      if (failOn && text.includes(failOn)) throw new Error("syntax error");
      if (text.startsWith("select name from schema_migrations")) {
        return { rows: alreadyApplied.map((name) => ({ name })) };
      }
      return { rows: [] };
    },
  };
}

let dir;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "mmr-migrations-"));
  fs.writeFileSync(path.join(dir, "002_second.sql"), "create table second ();");
  fs.writeFileSync(path.join(dir, "001_first.sql"), "create table first ();");
  fs.writeFileSync(path.join(dir, "notes.txt"), "not a migration");
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

const quiet = { log: () => {} };

test("lists only .sql files in name order", () => {
  expect(listMigrationFiles(dir)).toEqual(["001_first.sql", "002_second.sql"]);
});

test("the real migrations folder has 001 to 004 in order", () => {
  expect(listMigrationFiles()).toEqual([
    "001_places.sql",
    "002_users.sql",
    "003_itineraries.sql",
    "004_lock_down_public_api.sql",
  ]);
});

test("applies new files in order, each inside a transaction, and records them", async () => {
  const client = fakeClient();
  const applied = await runMigrations(client, { dir, ...quiet });

  expect(applied).toEqual(["001_first.sql", "002_second.sql"]);
  const texts = client.calls.map((c) => c.text);
  expect(texts[0]).toMatch(/create table if not exists schema_migrations/);
  const firstBegin = texts.indexOf("begin");
  expect(texts.slice(firstBegin, firstBegin + 4)).toEqual([
    "begin",
    "create table first ();",
    "insert into schema_migrations (name) values ($1)",
    "commit",
  ]);
  expect(client.calls[firstBegin + 2].params).toEqual(["001_first.sql"]);
});

test("a second run applies nothing", async () => {
  const client = fakeClient(["001_first.sql", "002_second.sql"]);
  expect(await runMigrations(client, { dir, ...quiet })).toEqual([]);
  expect(client.calls.map((c) => c.text)).not.toContain("begin");
});

test("only applies files that are not recorded yet", async () => {
  const client = fakeClient(["001_first.sql"]);
  expect(await runMigrations(client, { dir, ...quiet })).toEqual(["002_second.sql"]);
});

test("rolls back and stops when a migration fails", async () => {
  const client = fakeClient([], "second");
  await expect(runMigrations(client, { dir, ...quiet })).rejects.toThrow(
    /002_second.sql failed and was rolled back/,
  );
  expect(client.calls.map((c) => c.text)).toContain("rollback");
});

test("a failing file is not recorded, not committed, and later files do not run", async () => {
  fs.writeFileSync(path.join(dir, "003_third.sql"), "create table third ();");
  const client = fakeClient([], "second");
  await expect(runMigrations(client, { dir, ...quiet })).rejects.toThrow(/002_second.sql/);

  const texts = client.calls.map((c) => c.text);
  const failedAt = texts.indexOf("create table second ();");
  expect(texts.slice(failedAt + 1)).toEqual(["rollback"]);
  expect(texts).not.toContain("create table third ();");
  const recorded = client.calls
    .filter((c) => c.text.startsWith("insert into schema_migrations"))
    .map((c) => c.params[0]);
  expect(recorded).toEqual(["001_first.sql"]);
  expect(texts.filter((t) => t === "commit")).toHaveLength(1);
});

test("logs each applied file, and says so when there is nothing to apply", async () => {
  const log = jest.fn();
  await runMigrations(fakeClient(), { dir, log });
  expect(log.mock.calls.map((c) => c[0])).toEqual([
    "Applied 001_first.sql",
    "Applied 002_second.sql",
  ]);

  const log2 = jest.fn();
  await runMigrations(fakeClient(["001_first.sql", "002_second.sql"]), { dir, log: log2 });
  expect(log2).toHaveBeenCalledWith(expect.stringMatching(/Nothing to apply/));
});

describe("real migration files", () => {
  const read = (f) => fs.readFileSync(path.join(__dirname, "../../db/migrations", f), "utf8");

  test("places has source and is_sample, and can be re-run safely", () => {
    const sql = read("001_places.sql");
    expect(sql).toMatch(/add column if not exists source/);
    expect(sql).toMatch(/add column if not exists is_sample boolean not null default false/);
    expect(sql).toMatch(/create table if not exists places/);
  });

  test("profiles has a user/admin role; preferences and itinerary tables exist", () => {
    const users = read("002_users.sql");
    expect(users).toMatch(/create table if not exists profiles/);
    expect(users).toMatch(
      /role\s+text not null default 'user' check \(role in \('user', 'admin'\)\)/,
    );
    expect(users).toMatch(/create table if not exists preferences/);
    const itin = read("003_itineraries.sql");
    expect(itin).toMatch(/create table if not exists itineraries/);
    expect(itin).toMatch(/create table if not exists itinerary_stops/);
  });

  test("every new table has row level security enabled", () => {
    const all = ["001_places.sql", "002_users.sql", "003_itineraries.sql"].map(read).join("\n");
    for (const table of ["places", "profiles", "preferences", "itineraries", "itinerary_stops"]) {
      expect(all).toMatch(new RegExp(`alter table ${table} enable row level security`));
    }
  });
});
