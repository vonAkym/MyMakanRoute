import { act, renderHook } from "@testing-library/react";
import { MAX_TRIP_STOPS, TripBasketProvider, moveItem, useTripBasket } from "./TripBasketContext";
import { STORAGE_KEYS } from "../lib/storage";

const place = (id) => ({ id, name: `Place ${id}`, lat: 5.41, lng: 100.33, label: null });
const wrapper = ({ children }) => <TripBasketProvider>{children}</TripBasketProvider>;
const ids = (result) => result.current.places.map((p) => p.id);

describe("moveItem", () => {
  test("moves an item and ignores moves past the ends", () => {
    expect(moveItem(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
    expect(moveItem(["a", "b"], 0, -1)).toEqual(["a", "b"]);
    expect(moveItem(["a", "b"], 1, 2)).toEqual(["a", "b"]);
  });
});

describe("TripBasketContext (Itinerary Planner)", () => {
  test("adds places once, removes and reorders them", () => {
    const { result } = renderHook(() => useTripBasket(), { wrapper });
    act(() => {
      result.current.addPlace(place("a"));
    });
    act(() => {
      result.current.addPlace(place("b"));
    });
    act(() => {
      result.current.addPlace(place("c"));
    });
    let addedAgain;
    act(() => {
      addedAgain = result.current.addPlace(place("a"));
    });
    expect(addedAgain).toBe(false);
    expect(ids(result)).toEqual(["a", "b", "c"]);

    act(() => result.current.movePlace("c", -1));
    expect(ids(result)).toEqual(["a", "c", "b"]);
    act(() => result.current.movePlace("a", -1)); // already first: no change
    expect(ids(result)).toEqual(["a", "c", "b"]);

    act(() => result.current.removePlace("c"));
    expect(ids(result)).toEqual(["a", "b"]);
    expect(result.current.hasPlace("a")).toBe(true);
    expect(result.current.hasPlace("c")).toBe(false);

    act(() => result.current.setOrder(["b", "a"]));
    expect(ids(result)).toEqual(["b", "a"]);
  });

  test("stops at the maximum number of stops", () => {
    const { result } = renderHook(() => useTripBasket(), { wrapper });
    for (let i = 0; i < MAX_TRIP_STOPS + 2; i++) {
      act(() => {
        result.current.addPlace(place(`p${i}`));
      });
    }
    expect(result.current.places).toHaveLength(MAX_TRIP_STOPS);
    expect(result.current.isFull).toBe(true);
  });

  test("persists to localStorage and loads it back", () => {
    const first = renderHook(() => useTripBasket(), { wrapper });
    act(() => {
      first.result.current.addPlace(place("x"));
    });
    act(() => {
      first.result.current.addPlace(place("y"));
    });
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEYS.tripBasket));
    expect(saved.map((p) => p.id)).toEqual(["x", "y"]);
    first.unmount();

    const second = renderHook(() => useTripBasket(), { wrapper });
    expect(ids(second.result)).toEqual(["x", "y"]);
  });

  test("ignores broken saved data", () => {
    window.localStorage.setItem(STORAGE_KEYS.tripBasket, "{not json");
    const { result } = renderHook(() => useTripBasket(), { wrapper });
    expect(result.current.places).toEqual([]);
  });
});

describe("TripBasketContext stored data", () => {
  test("drops basket items without a string id or real coordinates", () => {
    window.localStorage.setItem(
      STORAGE_KEYS.tripBasket,
      JSON.stringify([
        place("ok"),
        { ...place("no-lat"), lat: "5.4" },
        { ...place(1), id: 1 },
        null,
        { ...place("nan"), lng: null },
      ]),
    );
    const { result } = renderHook(() => useTripBasket(), { wrapper });
    expect(ids(result)).toEqual(["ok"]);
  });
});
