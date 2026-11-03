const request = require("supertest");

jest.mock("../../src/lib/db", () => ({ query: jest.fn() }));
const db = require("../../src/lib/db");
const app = require("../../src/app");

afterEach(() => jest.clearAllMocks());

describe("GET /health", () => {
  test("returns ok in the standard shape", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { status: "ok", app: "MyMakanRoute" } });
  });

  test("sends security headers (helmet) and hides x-powered-by", async () => {
    const res = await request(app).get("/health");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });
});

describe("GET /health/db", () => {
  test("returns the number of places", async () => {
    db.query.mockResolvedValue({ rows: [{ places: 1241 }] });
    const res = await request(app).get("/health/db");
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ status: "ok", database: "connected", places: 1241 });
    expect(db.query).toHaveBeenCalledWith(expect.stringMatching(/count\(\*\).*from places/));
  });

  test("a database failure gives 500 INTERNAL_ERROR without leaking details", async () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    db.query.mockRejectedValue(new Error("relation places does not exist, password=secret"));
    const res = await request(app).get("/health/db");
    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Something went wrong" },
    });
    expect(JSON.stringify(res.body)).not.toMatch(/places|secret|stack/);
    spy.mockRestore();
  });
});

describe("CORS", () => {
  test("allows a configured origin", async () => {
    const res = await request(app).get("/health").set("Origin", "http://localhost:5173");
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
  });

  test("does not allow other origins", async () => {
    const res = await request(app).get("/health").set("Origin", "http://evil.example");
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });
});
