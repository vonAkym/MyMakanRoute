// Food Stalls Analytics: reads the request and sends the response.

const { success } = require("../../lib/response");
const service = require("./service");

// GET /api/analytics/overview (optional preferences + pastPlaceIds for the suggestions)
async function getAnalyticsOverview(req, res) {
  success(res, await service.getAnalyticsOverview(req.query));
}

// GET /api/analytics/suggestions (Food Place Suggestion on the Discover page)
async function getFoodPlaceSuggestions(req, res) {
  success(res, await service.getFoodPlaceSuggestions(req.query));
}

module.exports = { getAnalyticsOverview, getFoodPlaceSuggestions };
