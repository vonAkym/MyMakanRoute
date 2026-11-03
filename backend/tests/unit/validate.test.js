const { z } = require("zod");
const { validate } = require("../../src/middleware/validate");
const { AppError } = require("../../src/lib/response");

const schemas = {
  query: z.object({ radius: z.coerce.number().int().min(100).max(5000).default(1000) }),
  body: z.object({ name: z.string().min(1) }),
};

describe("validate middleware", () => {
  test("replaces input with parsed values and calls next()", () => {
    const req = { query: { radius: "500" }, body: { name: "Line Clear" } };
    const next = jest.fn();
    validate(schemas)(req, {}, next);
    expect(next).toHaveBeenCalledWith();
    expect(req.query.radius).toBe(500);
  });

  test("applies defaults", () => {
    const req = { query: {}, body: { name: "x" } };
    validate(schemas)(req, {}, jest.fn());
    expect(req.query.radius).toBe(1000);
  });

  test("gives 400 VALIDATION_ERROR with a details array of {path, message}", () => {
    const req = { query: { radius: "99999" }, body: {} };
    const next = jest.fn();
    validate(schemas)(req, {}, next);

    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(AppError);
    expect(err.status).toBe(400);
    expect(err.code).toBe("VALIDATION_ERROR");
    expect(err.details.map((d) => d.path).sort()).toEqual(["body.name", "query.radius"]);
    err.details.forEach((d) => expect(typeof d.message).toBe("string"));
  });

  test("leaves input untouched when validation fails", () => {
    const req = { query: { radius: "1" }, body: { name: "ok" } };
    validate(schemas)(req, {}, jest.fn());
    expect(req.query.radius).toBe("1");
  });
});
