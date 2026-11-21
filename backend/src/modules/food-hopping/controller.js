// Route Planner: reads the request and sends the response.

const { success } = require("../../lib/response");
const { planRoute } = require("./service");

async function planRouteHandler(req, res) {
  const result = await planRoute(req.body);
  success(res, result);
}

module.exports = { planRouteHandler };
