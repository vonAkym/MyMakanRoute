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
    // Trip day and start time (Malaysian time) for the opening hours. Default: now.
    day: z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]).optional(),
    startTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "startTime must look like 09:30")
      .optional(),
    // Minutes spent eating at each stop.
    visitMinutes: z.number().int().min(5).max(180).optional(),
  })
  .strict()
  .refine((b) => b.startPlaceId === undefined || b.placeIds.includes(b.startPlaceId), {
    message: "startPlaceId must be one of placeIds",
    path: ["startPlaceId"],
  });

const router = express.Router();

router.post("/route", validate({ body: planRouteSchema }), asyncHandler(planRouteHandler));

module.exports = { router, planRouteSchema, MIN_STOPS, MAX_STOPS };
