// Food Stalls Analytics URLs, mounted at /api/analytics.

const express = require("express");
const { asyncHandler } = require("../../lib/response");
const controller = require("./controller");

const router = express.Router();

// No query parameters: the overview always covers every rated place.
router.get("/overview", asyncHandler(controller.getAnalyticsOverview));

module.exports = { router };
