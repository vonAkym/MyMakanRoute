// Food Hopping URLs, mounted at /api/hopping.

const express = require("express");
const { z } = require("zod");
const { validate } = require("../../middleware/validate");
const { asyncHandler } = require("../../lib/response");
const { planRouteHandler } = require("./controller");

const MIN_STOPS = 2;
const MAX_STOPS = 10;

// UUIDs are compared in lower case so "A1..." and "a1..." count as the same place.
const placeId = z
  .string()
  .uuid()
  .transform((s) => s.toLowerCase());

// Request body for POST /api/hopping/route (Route Planner).
const planRouteSchema = z
  .object({
    placeIds: z
      .array(placeId)
      .min(MIN_STOPS, `choose at least ${MIN_STOPS} places`)
      .max(MAX_STOPS, `choose at most ${MAX_STOPS} places`)
      .refine((ids) => new Set(ids).size === ids.length, "placeIds must not repeat"),
    travelMode: z.enum(["walking", "driving"]).default("walking"),
    startPlaceId: placeId.optional(),
    seed: z
      .number()
      .int()
      .min(0)
      .max(2 ** 32 - 1)
      .optional(),
  })
  .strict()
  .refine((b) => b.startPlaceId === undefined || b.placeIds.includes(b.startPlaceId), {
    message: "startPlaceId must be one of placeIds",
    path: ["startPlaceId"],
  });

const router = express.Router();

router.post("/route", validate({ body: planRouteSchema }), asyncHandler(planRouteHandler));

module.exports = { router, planRouteSchema, MIN_STOPS, MAX_STOPS };
