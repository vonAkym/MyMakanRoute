// Food Discovery URLs (mounted at /api/discovery) and their input checks.

const express = require("express");
const { z } = require("zod");
const { validate } = require("../../middleware/validate");
const { asyncHandler } = require("../../lib/response");
const controller = require("./controller");

// Query values arrive as strings. An empty value ("?radius=") counts as not given,
// so z.coerce.number() cannot quietly turn it into 0.
const blankToUndefined = (schema) => z.preprocess((v) => (v === "" ? undefined : v), schema);

const numberParam = (name) =>
  z.coerce.number({ error: `${name} must be a number` }).refine(Number.isFinite, {
    message: `${name} must be a number`,
  });

// "true" / "false" only. (z.coerce.boolean() would turn the text "false" into true.)
const booleanParam = z
  .enum(["true", "false"], { error: "must be true or false" })
  .transform((v) => v === "true")
  .optional();

// "Chinese, Malay" -> ["chinese", "malay"]
const listParam = (itemSchema) =>
  z
    .string()
    .max(200)
    .transform((text) =>
      text
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    )
    .pipe(z.array(itemSchema).max(10))
    .optional();

const searchFoodPlacesQuery = z.object({
  lat: blankToUndefined(numberParam("lat").pipe(z.number().min(-90).max(90))),
  lng: blankToUndefined(numberParam("lng").pipe(z.number().min(-180).max(180))),
  // Search radius in metres.
  radius: blankToUndefined(z.coerce.number().int().min(100).max(5000).default(1500)),
  halal: booleanParam,
  maxPrice: blankToUndefined(z.coerce.number().int().min(1).max(4).optional()),
  cuisine: listParam(z.string().max(50)),
  dietary: listParam(
    z
      .string()
      .max(30)
      .regex(/^[a-z][a-z-]*$/, "dietary tags use letters and dashes only"),
  ),
  openNow: booleanParam,
  label: z.enum(["hidden_gem", "popular"]).optional(),
  limit: blankToUndefined(z.coerce.number().int().min(1).max(100).default(50)),
});

const foodPlaceParams = z.object({ id: z.uuid("id must be a valid UUID") });

const router = express.Router();

router.get(
  "/places",
  validate({ query: searchFoodPlacesQuery }),
  asyncHandler(controller.searchFoodPlaces),
);
router.get(
  "/places/:id",
  validate({ params: foodPlaceParams }),
  asyncHandler(controller.getFoodPlace),
);

module.exports = { router, searchFoodPlacesQuery, foodPlaceParams };
