// Landing hero: heading, badges, buttons and the plate picture.
import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import Hero from "./Hero";
import { renderWithProviders } from "../../test/helpers";

describe("Hero", () => {
  it("renders the heading with the orange key word", () => {
    renderWithProviders(<Hero />);
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1).toHaveTextContent("Find Hidden Gems. Plan Your Food Trip");
    expect(within(h1).getByText("Food Trip")).toHaveClass("lp-highlight");
  });

  it("has 3 feature badges", () => {
    renderWithProviders(<Hero />);
    const list = screen.getByRole("list", { name: "Features" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(3);
  });

  it("CTA links go to /trip and /discover", () => {
    renderWithProviders(<Hero />);
    expect(screen.getByRole("link", { name: "Start Hopping" })).toHaveAttribute("href", "/trip");
    expect(screen.getByRole("link", { name: "See Places" })).toHaveAttribute("href", "/discover");
  });

  it("shows the plate photo (alt, size, loads first) and the Est. 2026 badge", () => {
    renderWithProviders(<Hero />);
    const img = screen.getByRole("img", { name: /nasi lemak/i });
    expect(img).toHaveAttribute("width", "736");
    expect(img).toHaveAttribute("height", "613");
    expect(img).toHaveAttribute("fetchpriority", "high");
    expect(img).not.toHaveAttribute("loading");
    expect(screen.getByText("2026")).toBeInTheDocument();
  });
});
