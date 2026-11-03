// Any request that no route handled ends here.

const { errorBody } = require("../lib/response");

function notFound(req, res) {
  res.status(404).json(errorBody("NOT_FOUND", `Route ${req.method} ${req.path} not found`));
}

module.exports = { notFound };
