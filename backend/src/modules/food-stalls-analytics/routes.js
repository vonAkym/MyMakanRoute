// Food Stalls Analytics URLs, mounted at /api/analytics.

const express = require("express");
const { z } = require("zod");
const { validate } = require("../../middleware/validate");
const { asyncHandler } = require("../../lib/response");
const { searchFoodPlacesQuery } = require("../food-discovery/routes");
const controller = require("./controller");

const MAX_PAST_PLACES = 50;

// The user's preferences use the same checks as the Food Discovery search, so the two
// pages read halal, maxPrice, cuisine and dietary the same way.
// pastPlaceIds: places in the user's saved trips, "id1,id2,..." (at most 50).
const suggestionQuery = searchFoodPlacesQuery
  .pick({ halal: true, maxPrice: true, cuisine: true, dietary: true })
  .extend({
    pastPlaceIds: z
      .string()
      .max(MAX_PAST_PLACES * 40)
      .transform((text) =>
        text
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      )
      .pipe(z.array(z.string().max(64)).max(MAX_PAST_PLACES))
      .optional(),
  });

const router = express.Router();

// The overview always covers every rated place; the optional preferences only change the
// "Suggested for you" list.
router.get(
  "/overview",
  validate({ query: suggestionQuery }),
  asyncHandler(controller.getAnalyticsOverview),
);
router.get(
  "/suggestions",
  validate({ query: suggestionQuery }),
  asyncHandler(controller.getFoodPlaceSuggestions),
);

module.exports = { router, suggestionQuery };
