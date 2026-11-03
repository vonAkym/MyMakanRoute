// Review fixes C and F for lib/db: SSL choice, sslmode stripping, no password in errors.

jest.mock("pg", () => {
  const Pool = jest.fn(function FakePool(options) {
    this.options = options;
    this.on = jest.fn();
    this.end = jest.fn().mockResolvedValue();
  });
  return { Pool };
});

const SECRET = "SuperSecretPw123";
const mockConfig = { databaseUrl: undefined, databaseSsl: undefined };
jest.mock("../../src/config", () => mockConfig);

const { Pool } = require("pg");
const db = require("../../src/lib/db");

afterEach(async () => {
  await db.closePool();
  Pool.mockClear();
  mockConfig.databaseUrl = undefined;
  mockConfig.databaseSsl = undefined;
});

describe("sslOptionsFor", () => {
  test("local hosts (including IPv6 [::1]) default to no SSL", () => {
    for (const host of ["localhost", "127.0.0.1", "[::1]"]) {
      expect(db.sslOptionsFor(`postgresql://u:p@${host}:5432/x`)).toBe(false);
    }
  });

  test("other hosts default to SSL", () => {
    expect(db.sslOptionsFor("postgresql://u:p@db.supabase.co:5432/x")).toEqual({
      rejectUnauthorized: false,
    });
  });

  test("DATABASE_SSL overrides the default both ways", () => {
    expect(db.sslOptionsFor("postgresql://u:p@localhost:5432/x", "require")).toEqual({
      rejectUnauthorized: false,
    });
    expect(db.sslOptionsFor("postgresql://u:p@db.supabase.co:5432/x", "disable")).toBe(false);
  });
});

describe("connectionStringFor", () => {
  test("removes sslmode and keeps other parameters", () => {
    const out = db.connectionStringFor(
      "postgresql://u:p@db.supabase.co:5432/postgres?sslmode=require&application_name=mmr",
    );
    expect(out).not.toMatch(/sslmode/);
    expect(out).toMatch(/application_name=mmr/);
    expect(out).toMatch(/^postgresql:\/\/u:p@db\.supabase\.co:5432\/postgres/);
  });

  test("returns the URL unchanged when there is no sslmode", () => {
    const url = "postgresql://u:p@db.supabase.co:5432/postgres";
    expect(db.connectionStringFor(url)).toBe(url);
  });
});

describe("getPool", () => {
  test("passes the stripped connection string and the DATABASE_SSL choice to pg", () => {
    mockConfig.databaseUrl = "postgresql://u:p@db.supabase.co:5432/postgres?sslmode=disable";
    mockConfig.databaseSsl = "require";
    db.getPool();
    const options = Pool.mock.instances[0].options;
    expect(options.connectionString).toBe("postgresql://u:p@db.supabase.co:5432/postgres");
    expect(options.ssl).toEqual({ rejectUnauthorized: false });
  });

  test("a malformed DATABASE_URL gives a clear error without the password", () => {
    mockConfig.databaseUrl = `postgresql://postgres:${SECRET}@[bad host:5432/postgres`;
    let error;
    try {
      db.getPool();
    } catch (err) {
      error = err;
    }
    expect(error.message).toBe("DATABASE_URL is not a valid URL");
    expect(JSON.stringify(error)).not.toContain(SECRET);
    expect(String(error.stack)).not.toContain(SECRET);
    expect(error.input).toBeUndefined();
    expect(Pool).not.toHaveBeenCalled();
  });
});
