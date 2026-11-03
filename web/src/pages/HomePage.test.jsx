// Landing page: all sections in order, skip link, About scrolls to How it works.
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import HomePage from "./HomePage";
import { renderWithProviders } from "../test/helpers";

function stubMatchMedia(matching) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query) => ({
      matches: matching.includes(query),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    })),
  );
}

// jsdom has no scrollIntoView; tests that add a mock remove it again afterwards.
const originalScrollIntoView = Element.prototype.scrollIntoView;
afterEach(() => {
  if (originalScrollIntoView) Element.prototype.scrollIntoView = originalScrollIntoView;
  else delete Element.prototype.scrollIntoView;
});

describe("HomePage (landing)", () => {
  it("has landmarks, a skip link and every section heading", () => {
    renderWithProviders(<HomePage />);
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveAttribute("id", "landing-main");
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Skip to main content" })).toHaveAttribute(
      "href",
      "#landing-main",
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Find Hidden Gems. Plan Your Food Trip",
    );
    for (const name of ["Hidden Gems Near You", "Plan Every Bite", "What Food Hoppers Say"]) {
      expect(screen.getByRole("heading", { level: 2, name })).toBeInTheDocument();
    }
  });

  it("About smooth-scrolls to the How it works section", () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    renderWithProviders(<HomePage />);
    fireEvent.click(screen.getByRole("link", { name: "About" }));
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
    expect(document.activeElement).toHaveAttribute("id", "how-it-works");
  });

  it("About jumps instantly when the user prefers reduced motion", () => {
    stubMatchMedia(["(prefers-reduced-motion: reduce)"]);
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    renderWithProviders(<HomePage />);
    fireEvent.click(screen.getByRole("link", { name: "About" }));
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "auto", block: "start" });
  });

  it("saving a place updates the navbar count", () => {
    renderWithProviders(<HomePage />);
    expect(screen.getByRole("link", { name: "Saved places (0)" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save Rasheed Mee Goreng" }));
    expect(screen.getByRole("link", { name: "Saved places (1)" })).toBeInTheDocument();
  });
});
