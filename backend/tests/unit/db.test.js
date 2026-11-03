// Fake config without DATABASE_URL, so this test behaves the same on every machine.
jest.mock("../../src/config", () => ({ databaseUrl: undefined }));

const db = require("../../src/lib/db");

describe("lib/db", () => {
  test("uses SSL for a remote database (Supabase) but not for localhost", () => {
    expect(db.sslOptionsFor("postgresql://u:p@localhost:5432/x")).toBe(false);
    expect(db.sslOptionsFor("postgresql://u:p@127.0.0.1:5432/x")).toBe(false);
    expect(
      db.sslOptionsFor("postgresql://u:p@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres"),
    ).toEqual({ rejectUnauthorized: false });
  });

  test("loading the module is fine; a query without DATABASE_URL gives a clear error", () => {
    expect(() => db.query("select 1")).toThrow(/DATABASE_URL is not set/);
  });
});
