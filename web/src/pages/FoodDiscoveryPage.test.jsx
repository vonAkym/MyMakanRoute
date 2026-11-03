import { vi } from "vitest";
import { fireEvent, screen, within } from "@testing-library/react";
import FoodDiscoveryPage from "./FoodDiscoveryPage";
import { mockFetch, ok, renderWithProviders } from "../test/helpers";
import { STORAGE_KEYS } from "../lib/storage";

// Leaflet needs a real browser layout; the map is tested by hand, not here.
vi.mock("../components/PlaceMap", () => ({
  default: ({ places }) => <div data-testid="map">{places.length} markers</div>,
}));

const place = (extra) => ({
  id: "11111111-1111-4111-8111-111111111111",
  name: "Gem Stall",
  cuisine: "chinese",
  area: "George Town",
  address: null,
  isHalal: false,
  priceLevel: 1,
  avgRating: 4.6,
  reviewCount: 40,
  dietary: [],
  openingHours: null,
  isSample: true,
  lat: 5.41,
  lng: 100.33,
  distanceM: 230,
  label: "Hidden Gem",
  ...extra,
});

const searchResult = {
  count: 3,
  places: [
    place(),
    place({
      id: "22222222-2222-4222-8222-222222222222",
      name: "Famous Laksa",
      avgRating: 4.4,
      reviewCount: 3000,
      label: "Popular",
    }),
    place({
      id: "33333333-3333-4333-8333-333333333333",
      name: "Unrated Kedai",
      avgRating: null,
      reviewCount: 0,
      label: null,
      isSample: false,
    }),
  ],
  thresholds: { minRating: 4.3, maxReviews: 100, popularMinReviews: 100 },
  note: "Ratings for sample places are invented for testing.",
};

describe("FoodDiscoveryPage", () => {
  test("lists rated places from the API with labels and the sample banner", async () => {
    const fetchFn = mockFetch({ "GET /api/discovery/places": ok(searchResult) });
    renderWithProviders(<FoodDiscoveryPage />);

    const list = await screen.findByRole("list", { name: "Food places" });
    expect(within(list).getByRole("heading", { name: "Gem Stall" })).toBeInTheDocument();
    expect(within(list).getByText("Hidden Gem")).toBeInTheDocument();
    expect(within(list).getByText("Popular")).toBeInTheDocument();
    // "Rated places only" is on by default, so the unrated place is hidden.
    expect(within(list).queryByText("Unrated Kedai")).not.toBeInTheDocument();
    expect(screen.getByText(/1 unrated places hidden/)).toBeInTheDocument();
    expect(screen.getByText(/Ratings for sample places are invented for testing/)).toBeVisible();
    expect(screen.getByTestId("map")).toHaveTextContent("2 markers");

    // Default search: Komtar, 1.5 km.
    const url = new URL(fetchFn.mock.calls[0][0]);
    expect(url.searchParams.get("lat")).toBe("5.4145");
    expect(url.searchParams.get("lng")).toBe("100.3292");
    expect(url.searchParams.get("radius")).toBe("1500");
  });

  test("switching off 'Rated places only' shows unrated places", async () => {
    mockFetch({ "GET /api/discovery/places": ok(searchResult) });
    renderWithProviders(<FoodDiscoveryPage />);
    await screen.findByRole("list", { name: "Food places" });

    fireEvent.click(screen.getByRole("checkbox", { name: "Rated places only" }));
    expect(screen.getByRole("heading", { name: "Unrated Kedai" })).toBeInTheDocument();
  });

  test("Add to trip puts the place in the basket", async () => {
    mockFetch({ "GET /api/discovery/places": ok(searchResult) });
    renderWithProviders(<FoodDiscoveryPage />);
    await screen.findByRole("list", { name: "Food places" });

    fireEvent.click(screen.getByRole("button", { name: "Add to trip: Gem Stall" }));
    expect(screen.getByRole("button", { name: "In trip: Gem Stall" })).toBeDisabled();
    const basket = JSON.parse(window.localStorage.getItem(STORAGE_KEYS.tripBasket));
    expect(basket.map((p) => p.name)).toEqual(["Gem Stall"]);
  });

  test("saved preferences become the starting filters", async () => {
    window.localStorage.setItem(
      STORAGE_KEYS.preferences,
      JSON.stringify({ halalOnly: true, maxBudget: 2, cuisines: ["malay"], dietary: [] }),
    );
    const fetchFn = mockFetch({ "GET /api/discovery/places": ok({ ...searchResult, places: [] }) });
    renderWithProviders(<FoodDiscoveryPage />);

    expect(await screen.findByText("No places match these filters")).toBeInTheDocument();
    const url = new URL(fetchFn.mock.calls[0][0]);
    expect(url.searchParams.get("halal")).toBe("true");
    expect(url.searchParams.get("maxPrice")).toBe("2");
    expect(url.searchParams.get("cuisine")).toBe("malay");
    expect(screen.getByText(/saved\s+preferences are used/)).toBeInTheDocument();
  });

  test("shows a friendly error when the backend is down", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    renderWithProviders(<FoodDiscoveryPage />);
    expect(await screen.findByText("Could not load food places")).toBeInTheDocument();
    expect(screen.getByText(/Cannot reach the MyMakanRoute server/)).toBeInTheDocument();
  });
});
