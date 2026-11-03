// Food Discovery: reads the (already validated) request and sends the response.

const { success } = require("../../lib/response");
const service = require("./service");

// GET /api/discovery/places (Food Place Searching + Hidden Gem Highlighting)
async function searchFoodPlaces(req, res) {
  success(res, await service.searchFoodPlaces(req.query));
}

// GET /api/discovery/places/:id
async function getFoodPlace(req, res) {
  success(res, await service.getFoodPlace(req.params.id));
}

module.exports = { searchFoodPlaces, getFoodPlace };
