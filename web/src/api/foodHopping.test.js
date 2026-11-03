// Saved trips (Past Food Hopping Visualisation): stored entries with the wrong shape are dropped.
import { describe, expect, test } from "vitest";
import { listSavedTrips } from "./foodHopping";
import { STORAGE_KEYS } from "../lib/storage";

describe("listSavedTrips", () => {
  test("keeps only trips with a string id and a route with stops", async () => {
    const good = { id: "trip-1", name: "Hop", route: { stops: [] } };
    window.localStorage.setItem(
      STORAGE_KEYS.savedTrips,
      JSON.stringify([good, null, { id: 5, route: { stops: [] } }, { id: "trip-2", route: {} }]),
    );
    expect(await listSavedTrips()).toEqual([good]);
  });

  test("returns an empty list when the stored value is not an array", async () => {
    window.localStorage.setItem(STORAGE_KEYS.savedTrips, JSON.stringify({ id: "x" }));
    expect(await listSavedTrips()).toEqual([]);
  });
});
