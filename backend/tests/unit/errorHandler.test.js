// Review fixes C (safe logging) and G (headersSent, exposed client errors) for errorHandler.
const util = require("util");
const { errorHandler } = require("../../src/middleware/errorHandler");

function fakeRes(headersSent = false) {
  const res = { headersSent };
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}
const req = { method: "GET", originalUrl: "/x" };

let errorSpy;
beforeEach(() => {
  errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => errorSpy.mockRestore());

test("C: logs only safe fields, so extra properties like `input` never reach the log", () => {
  const SECRET = "SuperSecretPw123";
  const err = new TypeError("Invalid URL");
  err.code = "ERR_INVALID_URL";
  err.input = `postgresql://postgres:${SECRET}@[bad host/postgres`;
  const res = fakeRes();

  errorHandler(err, req, res, jest.fn());

  expect(res.status).toHaveBeenCalledWith(500);
  const logged = util.format(...errorSpy.mock.calls[0]);
  expect(logged).not.toContain(SECRET);
  expect(logged).toContain("Invalid URL");
  expect(logged).toContain("ERR_INVALID_URL");
});

test("G: when headers were already sent, hands the error to Express", () => {
  const err = new Error("late failure");
  const res = fakeRes(true);
  const next = jest.fn();
  errorHandler(err, req, res, next);
  expect(next).toHaveBeenCalledWith(err);
  expect(res.status).not.toHaveBeenCalled();
});

test("G: an exposed 4xx error keeps its status with a generic code and message", () => {
  const err = Object.assign(new Error('unsupported charset "UTF-7"'), {
    status: 415,
    expose: true,
    type: "charset.unsupported",
  });
  const res = fakeRes();
  errorHandler(err, req, res, jest.fn());
  expect(res.status).toHaveBeenCalledWith(415);
  expect(res.json).toHaveBeenCalledWith({
    success: false,
    error: { code: "UNSUPPORTED_MEDIA_TYPE", message: "Unsupported Media Type" },
  });
});

test("G: an exposed 400 error gives BAD_REQUEST", () => {
  const err = Object.assign(new Error("request aborted"), { status: 400, expose: true });
  const res = fakeRes();
  errorHandler(err, req, res, jest.fn());
  expect(res.status).toHaveBeenCalledWith(400);
  expect(res.json.mock.calls[0][0].error.code).toBe("BAD_REQUEST");
});

test("G: a 5xx error is never treated as exposed", () => {
  const err = Object.assign(new Error("internal detail"), { status: 503, expose: true });
  const res = fakeRes();
  errorHandler(err, req, res, jest.fn());
  expect(res.status).toHaveBeenCalledWith(500);
  expect(JSON.stringify(res.json.mock.calls[0][0])).not.toContain("internal detail");
});
