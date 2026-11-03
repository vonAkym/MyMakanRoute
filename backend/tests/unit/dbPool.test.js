// lib/db pool life cycle with a fake pg.Pool: no real database is contacted.

jest.mock("pg", () => {
  const Pool = jest.fn(function FakePool(options) {
    this.options = options;
    this.query = jest.fn().mockResolvedValue({ rows: [{ ok: 1 }] });
    this.on = jest.fn();
    this.end = jest.fn().mockResolvedValue();
  });
  return { Pool };
});
jest.mock("../../src/config", () => ({
  databaseUrl: "postgresql://u:p@db.example-project.supabase.co:5432/postgres",
}));

const { Pool } = require("pg");
const db = require("../../src/lib/db");

afterEach(async () => {
  await db.closePool();
  Pool.mockClear();
});

test("requiring the module does not create a pool", () => {
  expect(Pool).not.toHaveBeenCalled();
});

test("the first query creates one pool with SSL for a remote host, then reuses it", async () => {
  await db.query("select 1", []);
  await db.query("select 2");
  expect(Pool).toHaveBeenCalledTimes(1);
  const pool = Pool.mock.instances[0];
  expect(pool.options).toMatchObject({
    connectionString: "postgresql://u:p@db.example-project.supabase.co:5432/postgres",
    ssl: { rejectUnauthorized: false },
    max: 5,
  });
  expect(pool.query).toHaveBeenCalledWith("select 1", []);
  expect(db.pool).toBe(pool);
});

test("pool errors are logged instead of crashing the server", () => {
  const pool = db.getPool();
  const [event, handler] = pool.on.mock.calls[0];
  expect(event).toBe("error");
  const spy = jest.spyOn(console, "error").mockImplementation(() => {});
  expect(() => handler(new Error("connection lost"))).not.toThrow();
  expect(spy).toHaveBeenCalledWith(expect.any(String), "connection lost");
  spy.mockRestore();
});

test("closePool ends the pool and a later query makes a new one", async () => {
  const first = db.getPool();
  await db.closePool();
  expect(first.end).toHaveBeenCalledTimes(1);
  await db.closePool(); // closing twice is harmless
  expect(first.end).toHaveBeenCalledTimes(1);
  expect(db.getPool()).not.toBe(first);
});
