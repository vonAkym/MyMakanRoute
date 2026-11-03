// Checks req.body / req.query / req.params against zod schemas before the controller runs.
// Usage: router.get("/x", validate({ query: schema }), handler)
// On success the parsed (typed, defaulted) values replace the raw input.

const { AppError } = require("../lib/response");

const PARTS = ["params", "query", "body"];

function validate(schemas) {
  return (req, res, next) => {
    const details = [];
    const parsed = {};

    for (const part of PARTS) {
      if (!schemas[part]) continue;
      const result = schemas[part].safeParse(req[part] ?? {});
      if (result.success) {
        parsed[part] = result.data;
      } else {
        for (const issue of result.error.issues) {
          details.push({ path: [part, ...issue.path].join("."), message: issue.message });
        }
      }
    }

    if (details.length > 0) {
      return next(new AppError(400, "VALIDATION_ERROR", "Request input is invalid", details));
    }

    for (const part of Object.keys(parsed)) {
      // req.query is a getter in Express 5, so define it instead of assigning.
      Object.defineProperty(req, part, { value: parsed[part], writable: true, configurable: true });
    }
    return next();
  };
}

module.exports = { validate };
