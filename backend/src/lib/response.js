// One response shape for every endpoint:
//   success: { success: true, data }
//   failure: { success: false, error: { code, message, details? } }

function success(res, data, status = 200) {
  return res.status(status).json({ success: true, data });
}

// An expected problem (bad input, not found, not allowed). The errorHandler turns it
// into the failure shape with the given HTTP status.
class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function errorBody(code, message, details) {
  const error = { code, message };
  if (details !== undefined) error.details = details;
  return { success: false, error };
}

// Express 4 does not pass rejected promises to the error handler, so async route
// handlers are wrapped with this to forward any thrown error to next().
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

module.exports = { success, AppError, errorBody, asyncHandler };
