// Last middleware: turns every error into the standard failure shape.
// Unexpected errors are logged on the server only; the client never sees stack traces or SQL.

const { STATUS_CODES } = require("http");
const { AppError, errorBody } = require("../lib/response");

// Only these fields are logged. Logging the raw error object could leak extra
// properties (e.g. a TypeError's `input` holding a connection string with a password).
function safeLogFields(err) {
  return { name: err?.name, message: err?.message, code: err?.code, stack: err?.stack };
}

// 415 "Unsupported Media Type" -> "UNSUPPORTED_MEDIA_TYPE"
function codeForStatus(status) {
  return (STATUS_CODES[status] || "Bad Request").toUpperCase().replace(/[^A-Z]+/g, "_");
}

function errorHandler(err, req, res, next) {
  // The response already started streaming: let Express close the connection.
  if (res.headersSent) return next(err);

  if (err instanceof AppError) {
    return res.status(err.status).json(errorBody(err.code, err.message, err.details));
  }

  // Thrown by express.json() when the request body is not valid JSON.
  if (err.type === "entity.parse.failed") {
    return res.status(400).json(errorBody("INVALID_JSON", "Request body is not valid JSON"));
  }

  // Thrown by express.json() when the body is larger than the limit.
  if (err.type === "entity.too.large") {
    return res.status(413).json(errorBody("PAYLOAD_TOO_LARGE", "Request body is too large"));
  }

  // Other client errors from body-parser / http-errors (e.g. 415 unsupported charset,
  // 400 request aborted). Answer with a generic message, never the internal one.
  if (
    err.expose === true &&
    Number.isInteger(err.status) &&
    err.status >= 400 &&
    err.status < 500
  ) {
    const status = err.status;
    return res
      .status(status)
      .json(errorBody(codeForStatus(status), STATUS_CODES[status] || "Bad Request"));
  }

  console.error(`[${req.method} ${req.originalUrl}]`, safeLogFields(err));
  return res.status(500).json(errorBody("INTERNAL_ERROR", "Something went wrong"));
}

module.exports = { errorHandler };
