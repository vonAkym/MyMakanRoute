// validate + errorHandler through real HTTP requests, for body, query and params.

const express = require("express");
const request = require("supertest");
const { z } = require("zod");
const { AppError, success } = require("../../src/lib/response");
const { validate } = require("../../src/middleware/validate");
const { notFound } = require("../../src/middleware/notFound");
const { errorHandler } = require("../../src/middleware/errorHandler");
const app = require("../../src/app");

function buildTestApp() {
  const testApp = express();
  testApp.use(express.json({ limit: "100kb" }));
  testApp.get(
    "/places",
    validate({ query: z.object({ radius: z.coerce.number().int().min(100).max(5000) }) }),
    (req, res) => success(res, req.query),
  );
  testApp.get(
    "/places/:id",
    validate({ params: z.object({ id: z.string().uuid() }) }),
    (req, res) => success(res, req.params),
  );
  testApp.post(
    "/itineraries",
    validate({
      body: z.object({ title: z.string().min(1), stops: z.array(z.string()).min(2) }),
    }),
    (req, res) => success(res, req.body, 201),
  );
  testApp.get("/with-details", () => {
    throw new AppError(422, "BAD_STOP", "Stop is closed", [{ placeId: "x" }]);
  });
  testApp.get("/plain-error-with-status", () => {
    const err = new Error("internal detail");
    err.status = 403;
    throw err;
  });
  testApp.use(notFound);
  testApp.use(errorHandler);
  return testApp;
}

const testApp = buildTestApp();
let errorSpy;
beforeEach(() => {
  errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => errorSpy.mockRestore());

function expectValidationError(res, paths) {
  expect(res.status).toBe(400);
  expect(res.body.success).toBe(false);
  expect(res.body.error.code).toBe("VALIDATION_ERROR");
  expect(res.body.error.message).toBe("Request input is invalid");
  expect(res.body.error.details.map((d) => d.path).sort()).toEqual(paths);
  res.body.error.details.forEach((d) => expect(typeof d.message).toBe("string"));
}

describe("validation over HTTP", () => {
  test("query: invalid value gives 400 with query.* path", async () => {
    expectValidationError(await request(testApp).get("/places?radius=abc"), ["query.radius"]);
    expectValidationError(await request(testApp).get("/places?radius=99"), ["query.radius"]);
  });

  test("query: missing value gives 400", async () => {
    expectValidationError(await request(testApp).get("/places"), ["query.radius"]);
  });

  test("query: boundary value is coerced and passed on", async () => {
    const res = await request(testApp).get("/places?radius=100");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { radius: 100 } });
  });

  test("params: invalid id gives 400 with params.* path", async () => {
    expectValidationError(await request(testApp).get("/places/not-a-uuid"), ["params.id"]);
  });

  test("params: valid id passes", async () => {
    const id = "6f1c2b7e-1a2b-4c3d-8e9f-0a1b2c3d4e5f";
    const res = await request(testApp).get("/places/" + id);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ id });
  });

  test("body: every problem is listed", async () => {
    const res = await request(testApp)
      .post("/itineraries")
      .send({ title: "", stops: ["a"] });
    expectValidationError(res, ["body.stops", "body.title"]);
  });

  test("body: missing body is a validation error, not a crash", async () => {
    expectValidationError(await request(testApp).post("/itineraries"), [
      "body.stops",
      "body.title",
    ]);
  });

  test("body: valid input reaches the handler with the chosen status", async () => {
    const res = await request(testApp)
      .post("/itineraries")
      .send({ title: "Day 1", stops: ["a", "b"] });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ success: true, data: { title: "Day 1", stops: ["a", "b"] } });
  });
});

describe("errorHandler mapping", () => {
  test("AppError details are passed to the client", async () => {
    const res = await request(testApp).get("/with-details");
    expect(res.status).toBe(422);
    expect(res.body).toEqual({
      success: false,
      error: { code: "BAD_STOP", message: "Stop is closed", details: [{ placeId: "x" }] },
    });
  });

  test("a plain Error is always 500 and its message is hidden, even with a status", async () => {
    const res = await request(testApp).get("/plain-error-with-status");
    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Something went wrong" },
    });
    expect(errorSpy).toHaveBeenCalled();
  });

  test("a body larger than 100kb gives 413 PAYLOAD_TOO_LARGE", async () => {
    const res = await request(app)
      .post("/health")
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ big: "x".repeat(110 * 1024) }));
    expect(res.status).toBe(413);
    expect(res.body).toEqual({
      success: false,
      error: { code: "PAYLOAD_TOO_LARGE", message: "Request body is too large" },
    });
  });

  test("unknown route with a query string reports only the path", async () => {
    const res = await request(app).delete("/api/nothing?token=abc");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      success: false,
      error: { code: "NOT_FOUND", message: "Route DELETE /api/nothing not found" },
    });
  });

  test("a known path with the wrong method is 404 in the standard shape", async () => {
    const res = await request(app).post("/health").send({});
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});
