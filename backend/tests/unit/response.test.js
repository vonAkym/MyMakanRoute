const { success, AppError, errorBody, asyncHandler } = require("../../src/lib/response");

function fakeRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

describe("success", () => {
  test("sends { success: true, data } with status 200 by default", () => {
    const res = fakeRes();
    success(res, { a: 1 });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { a: 1 } });
  });

  test("uses the given status", () => {
    const res = fakeRes();
    success(res, { id: "x" }, 201);
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe("AppError", () => {
  test("keeps status, code, message and details", () => {
    const err = new AppError(404, "NOT_FOUND", "Place not found", [{ path: "id" }]);
    expect(err).toBeInstanceOf(Error);
    expect(err.status).toBe(404);
    expect(err.code).toBe("NOT_FOUND");
    expect(err.message).toBe("Place not found");
    expect(err.details).toEqual([{ path: "id" }]);
  });
});

describe("errorBody", () => {
  test("omits details when there are none", () => {
    expect(errorBody("X", "msg")).toEqual({ success: false, error: { code: "X", message: "msg" } });
  });
});

describe("asyncHandler", () => {
  test("passes a rejected promise to next()", async () => {
    const boom = new Error("boom");
    const next = jest.fn();
    await asyncHandler(async () => {
      throw boom;
    })({}, {}, next);
    expect(next).toHaveBeenCalledWith(boom);
  });

  test("does not call next() when the handler succeeds", async () => {
    const next = jest.fn();
    await asyncHandler(async () => {})({}, {}, next);
    expect(next).not.toHaveBeenCalled();
  });
});
