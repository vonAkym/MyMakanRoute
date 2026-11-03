import { fireEvent, screen, within } from "@testing-library/react";
import FoodStallsAnalyticsPage from "./FoodStallsAnalyticsPage";
import { mockFetch, ok, renderWithProviders } from "../test/helpers";

const overview = {
  totals: {
    ratedPlaces: 55,
    hiddenGems: 20,
    popular: 25,
    unlabelled: 10,
    averageRating: 4.31,
    halalPlaces: 22,
    halalShare: 0.4,
    samplePlaces: 55,
  },
  labels: [
    { label: "Hidden Gem", count: 20 },
    { label: "Popular", count: 25 },
    { label: "No label", count: 10 },
  ],
  labelAverages: { hiddenGem: null, popular: null },
  byArea: [
    { name: "Pulau Tikus", places: 6, averageRating: 4.45 },
    { name: "George Town", places: 28, averageRating: 4.3 },
  ],
  byCuisine: [{ name: "chinese", places: 19, averageRating: 4.35 }],
  points: [{ id: "p1", name: "Gem Stall", avgRating: 4.7, reviewCount: 40, label: "Hidden Gem" }],
  suggestions: [
    {
      id: "p1",
      name: "Gem Stall",
      area: "Pulau Tikus",
      cuisine: "chinese",
      isHalal: false,
      avgRating: 4.7,
      reviewCount: 40,
      label: "Hidden Gem",
    },
  ],
  findings: [
    "Pulau Tikus has the highest average rating (4.5) among areas with at least 3 rated places.",
    "20 of 55 rated places (36%) are Hidden Gems: rated 4.3 or higher with 100 reviews or fewer.",
  ],
  thresholds: { minRating: 4.3, maxReviews: 100, popularMinReviews: 100 },
  note: "Ratings for sample places are invented for testing.",
};

describe("FoodStallsAnalyticsPage", () => {
  test("shows KPIs, findings, suggestions and the sample banner", async () => {
    mockFetch({ "GET /api/analytics/overview": ok(overview) });
    renderWithProviders(<FoodStallsAnalyticsPage />);

    const findings = await screen.findByRole("region", { name: "Findings" });
    expect(within(findings).getAllByRole("listitem")).toHaveLength(2);
    expect(within(findings).getByText(/Pulau Tikus has the highest average rating/)).toBeVisible();

    expect(screen.getByText("Rated places").nextSibling).toHaveTextContent("55");
    expect(screen.getByText("40%")).toBeInTheDocument();
    expect(screen.getByText(/Ratings for sample places are invented/)).toBeInTheDocument();

    const suggestions = screen.getByRole("region", { name: "Suggested hidden gems" });
    expect(within(suggestions).getByText("Gem Stall")).toBeInTheDocument();
    expect(within(suggestions).getByText("Hidden Gem")).toBeInTheDocument();
  });

  test("each chart has a data table fallback", async () => {
    mockFetch({ "GET /api/analytics/overview": ok(overview) });
    renderWithProviders(<FoodStallsAnalyticsPage />);

    const areaCard = await screen.findByRole("region", { name: "Average rating by area" });
    fireEvent.click(within(areaCard).getByRole("button", { name: /show data table/i }));
    const table = within(areaCard).getByRole("table");
    expect(within(table).getByRole("rowheader", { name: "Pulau Tikus" })).toBeInTheDocument();
    expect(within(table).getByText("4.5")).toBeInTheDocument();
  });

  test("shows an error with a retry button when the API fails", async () => {
    mockFetch({
      "GET /api/analytics/overview": {
        status: 500,
        body: {
          success: false,
          error: { code: "INTERNAL_ERROR", message: "Something went wrong" },
        },
      },
    });
    renderWithProviders(<FoodStallsAnalyticsPage />);
    expect(await screen.findByText("Could not load analytics")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });
});
