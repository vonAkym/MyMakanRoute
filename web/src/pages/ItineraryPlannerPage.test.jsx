import { vi } from "vitest";
import { fireEvent, screen, within } from "@testing-library/react";
import ItineraryPlannerPage from "./ItineraryPlannerPage";
import { mockFetch, ok, renderWithProviders } from "../test/helpers";
import { STORAGE_KEYS } from "../lib/storage";

vi.mock("../components/PlaceMap", () => ({
  default: ({ places, legs }) => (
    <div data-testid="map">
      {places.length} stops, {legs.length} lines
    </div>
  ),
}));

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const basketPlace = (id, name) => ({
  id,
  name,
  lat: 5.41,
  lng: 100.33,
  label: "Hidden Gem",
  area: "George Town",
  isSample: true,
});

function putInBasket() {
  window.localStorage.setItem(
    STORAGE_KEYS.tripBasket,
    JSON.stringify([
      basketPlace(A, "Stall A"),
      basketPlace(B, "Stall B"),
      basketPlace(C, "Stall C"),
    ]),
  );
}

// Same shape as backend/src/modules/food-hopping/service.js planRoute().
const routeResponse = {
  travelMode: "walking",
  order: [
    {
      id: A,
      name: "Stall A",
      lat: 5.41,
      lng: 100.33,
      avg_rating: 4.5,
      review_count: 40,
      is_sample: true,
    },
    {
      id: C,
      name: "Stall C",
      lat: 5.412,
      lng: 100.331,
      avg_rating: 4.4,
      review_count: 20,
      is_sample: true,
    },
    {
      id: B,
      name: "Stall B",
      lat: 5.414,
      lng: 100.332,
      avg_rating: 4.6,
      review_count: 10,
      is_sample: true,
    },
  ],
  legs: [
    {
      fromPlaceId: A,
      toPlaceId: C,
      timeS: 300,
      distanceM: 400,
      path: [
        [5.41, 100.33],
        [5.412, 100.331],
      ],
    },
    {
      fromPlaceId: C,
      toPlaceId: B,
      timeS: 240,
      distanceM: 320,
      path: [
        [5.412, 100.331],
        [5.414, 100.332],
      ],
    },
  ],
  totalTimeS: 540,
  totalDistanceM: 720,
  comparison: {
    aco: { order: [A, C, B], totalTimeS: 540, runtimeMs: 3.2 },
    nearestNeighbour: { order: [A, B, C], totalTimeS: 660, runtimeMs: 0.1 },
    bruteForce: { order: [A, C, B], totalTimeS: 540, runtimeMs: 0.2 },
  },
  algorithm: {
    name: "ant-colony-optimisation",
    ants: 20,
    iterations: 100,
    alpha: 1,
    beta: 3,
    evaporation: 0.5,
    seed: 42,
    iterationsRun: 30,
    bestFoundAtIteration: 2,
  },
  graph: { source: "osm-roads", nodes: 1000, edges: 2000 },
};

describe("ItineraryPlannerPage", () => {
  test("with fewer than 2 stops it explains what to do", () => {
    renderWithProviders(<ItineraryPlannerPage />);
    expect(screen.getByText("Your trip is empty")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /find places on discover/i })).toBeInTheDocument();
  });

  test("plans a route and shows the ACO comparison card", async () => {
    putInBasket();
    const fetchFn = mockFetch({ "POST /api/hopping/route": ok(routeResponse) });
    renderWithProviders(<ItineraryPlannerPage />);

    fireEvent.click(screen.getByRole("button", { name: "Plan route" }));

    const card = await screen.findByRole("region", { name: "Algorithm comparison" });
    expect(within(card).getAllByText("9 min")).toHaveLength(2); // ACO and brute force
    expect(within(card).getByText("11 min")).toBeInTheDocument(); // nearest neighbour
    expect(within(card).getByText(/ACO matched the optimal order/)).toBeInTheDocument();
    expect(
      within(card).getByText(/ACO saved 2 min compared with nearest neighbour/),
    ).toBeInTheDocument();

    // Request body sent to the backend.
    const body = JSON.parse(fetchFn.mock.calls[0][1].body);
    expect(body).toEqual({ placeIds: [A, B, C], travelMode: "walking", startPlaceId: A });

    // Stops are shown in the order ACO chose, with the legs on the map.
    const stops = screen.getByRole("region", { name: /stops/i });
    const names = within(stops)
      .getAllByRole("listitem")
      .map((li) => li.querySelector(".stop__name").textContent);
    expect(names).toEqual(["Stop 1: Stall A", "Stop 2: Stall C", "Stop 3: Stall B"]);
    expect(screen.getByTestId("map")).toHaveTextContent("3 stops, 2 lines");
    const summary = screen.getByRole("region", { name: "Your route" });
    expect(within(summary).getByText("9 min")).toBeInTheDocument(); // 540 s total
    expect(within(summary).getByText("720 m")).toBeInTheDocument();
    // Per-leg time and distance between stops.
    expect(within(stops).getByText("5 min · 400 m")).toBeInTheDocument();
  });

  test("moving a stop marks the route as out of date; saving stores it on this device", async () => {
    putInBasket();
    mockFetch({ "POST /api/hopping/route": ok(routeResponse) });
    renderWithProviders(<ItineraryPlannerPage />);
    fireEvent.click(screen.getByRole("button", { name: "Plan route" }));
    await screen.findByRole("region", { name: "Algorithm comparison" });

    fireEvent.click(screen.getByRole("button", { name: "Save trip" }));
    expect(await screen.findByText(/Saved on this device/)).toBeInTheDocument();
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEYS.savedTrips));
    expect(saved).toHaveLength(1);
    expect(saved[0].route.stops.map((s) => s.id)).toEqual([A, C, B]);

    fireEvent.click(screen.getByRole("button", { name: "Move Stall B up" }));
    expect(screen.getByText(/You changed the trip/)).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Algorithm comparison" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Re-plan with ACO" })).toBeEnabled();
  });

  test("route planner unavailable -> friendly error, stops kept", async () => {
    putInBasket();
    mockFetch({}); // every URL answers 404 "Route not found"
    renderWithProviders(<ItineraryPlannerPage />);
    fireEvent.click(screen.getByRole("button", { name: "Plan route" }));

    expect(await screen.findByText("Could not plan the route")).toBeInTheDocument();
    expect(
      screen.getByText(/route planner is not available on this server yet/),
    ).toBeInTheDocument();
    const stops = screen.getByRole("region", { name: /stops/i });
    expect(within(stops).getAllByRole("listitem")).toHaveLength(3);
  });
});
