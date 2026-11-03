const express = require("express");
const request = require("supertest");
const { z } = require("zod");
const app = require("../../src/app");
const { AppError, asyncHandler, success } = require("../../src/lib/response");
const { validate } = require("../../src/middleware/validate");
const { notFound } = require("../../src/middleware/notFound");
const { errorHandler } = require("../../src/middleware/errorHandler");

// A small app wired like src/app.js, with routes that fail on purpose.
function buildTestApp() {
  const testApp = express();
  testApp.use(express.json());
  testApp.get("/app-error", () => {
    throw new AppError(409, "EMAIL_TAKEN", "Email already registered");
  });
  testApp.get(
    "/async-crash",
    asyncHandler(async () => {
      throw new Error("select * from secret_table failed");
    }),
  );
  testApp.post(
    "/validated",
    validate({ body: z.object({ radius: z.number().min(100) }) }),
    (req, res) => success(res, req.body),
  );
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

test("unknown URL gives 404 NOT_FOUND in the standard shape", async () => {
  const res = await request(app).get("/no-such-route");
  expect(res.status).toBe(404);
  expect(res.body).toEqual({
    success: false,
    error: { code: "NOT_FOUND", message: "Route GET /no-such-route not found" },
  });
});

test("malformed JSON body gives 400 INVALID_JSON", async () => {
  const res = await request(app)
    .post("/health")
    .set("Content-Type", "application/json")
    .send("{ broken json");
  expect(res.status).toBe(400);
  expect(res.body).toEqual({
    success: false,
    error: { code: "INVALID_JSON", message: "Request body is not valid JSON" },
  });
});

test("AppError keeps its status and code", async () => {
  const res = await request(testApp).get("/app-error");
  expect(res.status).toBe(409);
  expect(res.body).toEqual({
    success: false,
    error: { code: "EMAIL_TAKEN", message: "Email already registered" },
  });
});

test("unexpected async errors give 500 and hide the message, but are logged", async () => {
  const res = await request(testApp).get("/async-crash");
  expect(res.status).toBe(500);
  expect(res.body.error).toEqual({ code: "INTERNAL_ERROR", message: "Something went wrong" });
  expect(JSON.stringify(res.body)).not.toMatch(/secret_table|stack/);
  expect(errorSpy).toHaveBeenCalled();
});

test("validation failure gives 400 VALIDATION_ERROR with details", async () => {
  const res = await request(testApp).post("/validated").send({ radius: 5 });
  expect(res.status).toBe(400);
  expect(res.body.error.code).toBe("VALIDATION_ERROR");
  expect(res.body.error.details).toEqual([{ path: "body.radius", message: expect.any(String) }]);
});

test("valid input reaches the handler", async () => {
  const res = await request(testApp).post("/validated").send({ radius: 500 });
  expect(res.status).toBe(200);
  expect(res.body).toEqual({ success: true, data: { radius: 500 } });
});

test("an unsupported JSON charset gives 415 with a generic message", async () => {
  const res = await request(app)
    .post("/health")
    .set("Content-Type", "application/json; charset=latin1")
    .send("{}");
  expect(res.status).toBe(415);
  expect(res.body).toEqual({
    success: false,
    error: { code: "UNSUPPORTED_MEDIA_TYPE", message: "Unsupported Media Type" },
  });
});
