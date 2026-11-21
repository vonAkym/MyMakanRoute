// Saved trips (Past Food Hopping Visualisation): stored entries with the wrong shape are dropped.
import { describe, expect, test } from "vitest";
import { listPastPlaceIds, listSavedTrips } from "./foodHopping";
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

describe("listPastPlaceIds (past choices for Food Place Suggestion)", () => {
  test("returns each stop id from saved trips once, newest trip first", async () => {
    const trip = (id, stopIds) => ({ id, route: { stops: stopIds.map((s) => ({ id: s })) } });
    window.localStorage.setItem(
      STORAGE_KEYS.savedTrips,
      JSON.stringify([trip("t2", ["c", "a"]), trip("t1", ["a", "b"])]),
    );
    expect(await listPastPlaceIds()).toEqual(["c", "a", "b"]);
  });

  test("no saved trips -> empty list", async () => {
    window.localStorage.removeItem(STORAGE_KEYS.savedTrips);
    expect(await listPastPlaceIds()).toEqual([]);
  });
});
