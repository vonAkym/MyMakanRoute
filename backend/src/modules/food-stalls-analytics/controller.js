// Food Stalls Analytics: reads the request and sends the response.

const { success } = require("../../lib/response");
const service = require("./service");

// GET /api/analytics/overview
async function getAnalyticsOverview(req, res) {
  success(res, await service.getAnalyticsOverview());
}

module.exports = { getAnalyticsOverview };
