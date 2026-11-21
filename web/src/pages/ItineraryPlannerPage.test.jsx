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
    expect(body).toMatchObject({ placeIds: [A, B, C], travelMode: "walking", startPlaceId: A });
    // Trip day and start time for the opening hours (default: today, next quarter hour).
    expect(body.day).toMatch(/^(mon|tue|wed|thu|fri|sat|sun)$/);
    expect(body.startTime).toMatch(/^\d\d:(00|15|30|45)$/);

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

  test("with opening hours: sends the chosen start, shows arrival times and closed stops", async () => {
    putInBasket();
    const timetable = {
      ...routeResponse,
      order: routeResponse.order.map((p, k) => ({
        ...p,
        arrivalTime: ["09:00", "09:35", "10:09"][k],
        waitS: k === 1 ? 600 : 0,
        closedOnArrival: k === 2,
        hasOpeningHours: true,
      })),
      schedule: {
        day: "sat",
        startTime: "09:00",
        endTime: "10:09",
        visitMinutes: 30,
        durationS: 4140,
        waitS: 600,
        closedStops: 1,
        usesOpeningHours: true,
      },
      comparison: {
        aco: { ...routeResponse.comparison.aco, durationS: 4140, closedStops: 1 },
        nearestNeighbour: { ...routeResponse.comparison.nearestNeighbour, closedStops: 2 },
        bruteForce: { ...routeResponse.comparison.bruteForce, durationS: 4140, closedStops: 1 },
      },
    };
    const fetchFn = mockFetch({ "POST /api/hopping/route": ok(timetable) });
    renderWithProviders(<ItineraryPlannerPage />);

    fireEvent.change(screen.getByLabelText("Day"), { target: { value: "sat" } });
    fireEvent.change(screen.getByLabelText("Start time"), { target: { value: "09:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Plan route" }));
    const card = await screen.findByRole("region", { name: "Algorithm comparison" });

    const body = JSON.parse(fetchFn.mock.calls[0][1].body);
    expect(body).toMatchObject({ day: "sat", startTime: "09:00" });
    const stops = screen.getByRole("region", { name: /stops/i });
    expect(within(stops).getByText(/Arrive 09:35/)).toHaveTextContent("wait 10 min until it opens");
    expect(within(stops).getByText("Closed when you arrive")).toBeInTheDocument();
    expect(screen.getByText(/1 stop is closed when you/)).toBeInTheDocument();
    expect(within(card).getByText(/ACO matched the best timetable/)).toBeInTheDocument();
    expect(within(card).getByText(/would reach 2 stops after closing time/)).toBeInTheDocument();

    // Changing the start time makes the plan out of date.
    fireEvent.change(screen.getByLabelText("Start time"), { target: { value: "08:00" } });
    expect(screen.getByText(/You changed the trip/)).toBeInTheDocument();
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
