// Landing place cards and grid.
import { describe, expect, it } from "vitest";
import { fireEvent, screen, within } from "@testing-library/react";
import PlaceCard from "./PlaceCard";
import PlaceGrid from "./PlaceGrid";
import { FEATURED_PLACES } from "../../data/landingContent";
import { renderWithProviders } from "../../test/helpers";

const gem = FEATURED_PLACES[0];
const popular = FEATURED_PLACES.find((p) => p.label === "Popular");

describe("PlaceCard", () => {
  it("shows name, description, label, rating, reviews, price range and a lazy photo", () => {
    renderWithProviders(<PlaceCard place={gem} />);
    expect(screen.getByRole("heading", { name: "Rasheed Mee Goreng" })).toBeInTheDocument();
    expect(screen.getByText("Wok-fried yellow noodles, mamak style.")).toBeInTheDocument();
    expect(screen.getByText("Hidden Gem")).toBeInTheDocument();
    expect(screen.getByText("4.3")).toBeInTheDocument();
    expect(screen.getByText("(42 reviews)")).toBeInTheDocument();
    expect(screen.getByText("RM5–10")).toBeInTheDocument();
    const img = screen.getByRole("img", { name: /mee goreng/i });
    expect(img).toHaveAttribute("loading", "lazy");
    expect(img).toHaveAttribute("width", "500");
    expect(img).toHaveAttribute("height", "333");
  });

  it("shows the Popular label for a popular place", () => {
    renderWithProviders(<PlaceCard place={popular} />);
    expect(screen.getByText("Popular")).toBeInTheDocument();
    expect(screen.getByText("(1,650 reviews)")).toBeInTheDocument();
  });

  it("save toggles aria-pressed and survives a re-render", () => {
    const { unmount } = renderWithProviders(<PlaceCard place={gem} />);
    const save = screen.getByRole("button", { name: `Save ${gem.name}` });
    expect(save).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(save);
    expect(save).toHaveAttribute("aria-pressed", "true");

    unmount();
    renderWithProviders(<PlaceCard place={gem} />);
    expect(screen.getByRole("button", { name: `Save ${gem.name}` })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});

describe("PlaceGrid", () => {
  it("renders one card per place from the data file and a View all link", () => {
    renderWithProviders(<PlaceGrid />);
    const section = screen.getByRole("region", { name: "Hidden Gems Near You" });
    expect(within(section).getAllByRole("article")).toHaveLength(FEATURED_PLACES.length);
    expect(screen.getByRole("link", { name: "View All Places" })).toHaveAttribute(
      "href",
      "/discover",
    );
    expect(
      screen.getByText("Sample ratings, not real reviews. Photos are illustrative."),
    ).toBeInTheDocument();
  });
});
