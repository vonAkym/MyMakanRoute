// Demo mode (GitHub Pages build): the in-browser answers must match the backend's rules
// and data shapes.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { demoRequest } from "./demoApi";
import { DEMO_PLACES } from "./places";
import { isOpenAt, labelHiddenGem } from "./discovery";
import { buildTimeMatrix } from "./routePlanner";
import { isDemoMode } from "../api/client";
import demoSeed from "./sample-places.json";

const KOMTAR = { lat: 5.4145, lng: 100.3292 };

const search = (query) => demoRequest("/api/discovery/places", { query: { ...KOMTAR, ...query } });
const route = (body) => demoRequest("/api/hopping/route", { method: "POST", body });

describe("demo data", () => {
  test("is the same file as the backend seed", () => {
    const backendSeed = fileURLToPath(
      new URL("../../../backend/db/seeds/sample-places.json", import.meta.url),
    );
    expect(demoSeed).toEqual(JSON.parse(readFileSync(backendSeed, "utf8")));
  });

  test("has 55 sample places with unique ids", () => {
    expect(DEMO_PLACES).toHaveLength(55);
    expect(new Set(DEMO_PLACES.map((p) => p.id)).size).toBe(55);
    expect(DEMO_PLACES.every((p) => p.is_sample === true)).toBe(true);
  });
});

describe("isDemoMode", () => {
  test("is on for the GitHub Pages build or VITE_DEMO_MODE=true only", () => {
    expect(isDemoMode({ MODE: "pages" })).toBe(true);
    expect(isDemoMode({ MODE: "development", VITE_DEMO_MODE: "true" })).toBe(true);
    expect(isDemoMode({ MODE: "production" })).toBe(false);
    expect(isDemoMode({ MODE: "test" })).toBe(false);
  });
});

describe("Hidden Gem Highlighting (demo)", () => {
  const thresholds = { minRating: 4.3, maxReviews: 100, popularMinReviews: 100 };

  test("follows the three-outcome rule", () => {
    expect(labelHiddenGem({ avg_rating: 4.5, review_count: 40 }, thresholds)).toBe("Hidden Gem");
    expect(labelHiddenGem({ avg_rating: 3.9, review_count: 500 }, thresholds)).toBe("Popular");
    expect(labelHiddenGem({ avg_rating: 4.0, review_count: 50 }, thresholds)).toBeNull();
    expect(labelHiddenGem({ avg_rating: 4.8, review_count: 0 }, thresholds)).toBeNull();
  });
});

describe("Food Place Searching (demo)", () => {
  test("returns places inside the radius, Hidden Gems first, nearest first", async () => {
    const data = await search({ radius: 1500, limit: 100 });
    expect(data.count).toBeGreaterThan(0);
    expect(data.note).toMatch(/demo/i);
    expect(data.places.every((p) => p.distanceM <= 1500)).toBe(true);
    const groups = data.places.map((p) => ({ "Hidden Gem": 0, Popular: 1 })[p.label] ?? 2);
    expect(groups).toEqual([...groups].sort((a, b) => a - b));
    const gems = data.places.filter((p) => p.label === "Hidden Gem").map((p) => p.distanceM);
    expect(gems).toEqual([...gems].sort((a, b) => a - b));
  });

  test("applies halal, price, cuisine, dietary and label filters", async () => {
    const halal = await search({ radius: 5000, halal: "true", maxPrice: 2 });
    expect(halal.places.every((p) => p.isHalal && p.priceLevel <= 2)).toBe(true);

    const malay = await search({ radius: 5000, cuisine: ["malay"] });
    expect(malay.places.length).toBeGreaterThan(0);
    expect(malay.places.every((p) => p.cuisine.toLowerCase().includes("malay"))).toBe(true);

    const vegan = await search({ radius: 5000, dietary: ["vegan"] });
    expect(vegan.places.every((p) => p.dietary.includes("vegan"))).toBe(true);

    const gems = await search({ radius: 5000, label: "hidden_gem" });
    expect(gems.places.every((p) => p.label === "Hidden Gem")).toBe(true);
  });

  test("respects the limit", async () => {
    expect((await search({ radius: 5000, limit: 3 })).count).toBe(3);
  });

  test("needs lat and lng", async () => {
    await expect(
      demoRequest("/api/discovery/places", { query: { radius: 1500 } }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", status: 400 });
  });

  test("open now uses Malaysian time and past-midnight ranges", () => {
    const hours = { fri: [["18:00", "02:00"]] };
    // Friday 20:00 and Saturday 01:00 in Kuala Lumpur (UTC+8).
    expect(isOpenAt(hours, new Date("2026-11-20T12:00:00Z"))).toBe(true);
    expect(isOpenAt(hours, new Date("2026-11-20T17:00:00Z"))).toBe(true);
    // Friday 10:00: closed.
    expect(isOpenAt(hours, new Date("2026-11-20T02:00:00Z"))).toBe(false);
    expect(isOpenAt({ osm: "Mo-Fr 09:00-17:00" })).toBe(false);
  });
});

describe("Food Place Visualisation (demo)", () => {
  test("finds one place by id, or answers 404", async () => {
    const id = DEMO_PLACES[0].id;
    const data = await demoRequest(`/api/discovery/places/${encodeURIComponent(id)}`);
    expect(data.place).toMatchObject({ id, isSample: true });
    await expect(demoRequest("/api/discovery/places/nope")).rejects.toMatchObject({
      code: "NOT_FOUND",
      status: 404,
    });
  });
});

describe("Route Planner (demo)", () => {
  const ids = DEMO_PLACES.filter((p) => p.area === "George Town").map((p) => p.id);

  test("plans an open route through every stop, starting at the first", async () => {
    const placeIds = ids.slice(0, 5);
    const data = await route({ placeIds, travelMode: "walking" });
    expect(data.order.map((p) => p.id).sort()).toEqual([...placeIds].sort());
    expect(data.order[0].id).toBe(placeIds[0]);
    expect(data.legs).toHaveLength(4);
    expect(data.legs.every((leg) => leg.path.length >= 2)).toBe(true);
    // Brute force is exact, so ACO and nearest neighbour can never beat it.
    const { aco, nearestNeighbour, bruteForce } = data.comparison;
    expect(bruteForce.totalTimeS).toBeLessThanOrEqual(aco.totalTimeS);
    expect(bruteForce.totalTimeS).toBeLessThanOrEqual(nearestNeighbour.totalTimeS);
    expect(data.graph.source).toMatch(/estimate/i);
  });

  test("starts at startPlaceId, and is the same each time with the same seed", async () => {
    const placeIds = ids.slice(0, 6);
    const a = await route({ placeIds, startPlaceId: placeIds[3], seed: 7 });
    const b = await route({ placeIds, startPlaceId: placeIds[3], seed: 7 });
    expect(a.order[0].id).toBe(placeIds[3]);
    expect(a.comparison.aco.order).toEqual(b.comparison.aco.order);
  });

  test("skips brute force above 8 stops", async () => {
    const data = await route({ placeIds: ids.slice(0, 10), travelMode: "driving" });
    expect(data.order).toHaveLength(10);
    expect(data.comparison.bruteForce).toBeNull();
  });

  test("driving is faster than walking on the same estimated distances", () => {
    const stops = DEMO_PLACES.slice(0, 4);
    const walk = buildTimeMatrix(stops, "walking");
    const drive = buildTimeMatrix(stops, "driving");
    expect(walk.distanceM).toEqual(drive.distanceM);
    expect(drive.timeS[0][1]).toBeLessThan(walk.timeS[0][1]);
  });

  test("checks the request like the backend", async () => {
    await expect(route({ placeIds: ids.slice(0, 1) })).rejects.toMatchObject({ status: 400 });
    await expect(route({ placeIds: ids.slice(0, 11) })).rejects.toMatchObject({ status: 400 });
    await expect(route({ placeIds: [ids[0], ids[0]] })).rejects.toMatchObject({ status: 400 });
    await expect(route({ placeIds: [ids[0], "missing"] })).rejects.toMatchObject({
      code: "NOT_FOUND",
      status: 404,
    });
  });
});

describe("Food Stalls Analytics (demo)", () => {
  test("builds the overview with totals, findings and up to 5 hidden gem suggestions", async () => {
    const data = await demoRequest("/api/analytics/overview");
    expect(data.totals.ratedPlaces).toBe(55);
    expect(data.totals.hiddenGems + data.totals.popular + data.totals.unlabelled).toBe(55);
    expect(data.labels.map((l) => l.label)).toEqual(["Hidden Gem", "Popular", "No label"]);
    expect(data.points).toHaveLength(55);
    expect(data.suggestions.length).toBeLessThanOrEqual(5);
    expect(data.suggestions.every((p) => p.label === "Hidden Gem")).toBe(true);
    expect(data.findings.length).toBeGreaterThanOrEqual(3);
    const ratings = data.byArea.map((g) => g.averageRating);
    expect(ratings).toEqual([...ratings].sort((a, b) => b - a));
  });
});

test("unknown endpoints answer 404 in the demo", async () => {
  await expect(demoRequest("/api/auth/login", { method: "POST" })).rejects.toMatchObject({
    status: 404,
  });
});
