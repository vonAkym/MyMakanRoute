// Landing Navbar: menu toggle, active link, search, saved count, Escape.
import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen } from "@testing-library/react";
import { Route, Routes, useLocation } from "react-router-dom";
import Navbar from "./Navbar";
import { renderWithProviders } from "../../test/helpers";
import { STORAGE_KEYS } from "../../lib/storage";

// Shows where the router went, so we can check navigation.
function Where() {
  const location = useLocation();
  return <p data-testid="where">{location.pathname + location.search}</p>;
}

function renderNavbar(route = "/") {
  return renderWithProviders(
    <>
      <Navbar />
      <Routes>
        <Route path="*" element={<Where />} />
      </Routes>
    </>,
    { route },
  );
}

describe("Landing Navbar", () => {
  it("menu button toggles aria-expanded", () => {
    renderNavbar();
    const menu = screen.getByRole("button", { name: "Menu" });
    expect(menu).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(menu);
    expect(menu).toHaveAttribute("aria-expanded", "true");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(menu).toHaveAttribute("aria-expanded", "false");
  });

  it("marks the active link with aria-current", () => {
    renderNavbar("/");
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Discover" })).not.toHaveAttribute("aria-current");
  });

  it("links go to the right pages", () => {
    renderNavbar();
    expect(screen.getByRole("link", { name: "Plan" })).toHaveAttribute("href", "/trip");
    expect(screen.getByRole("link", { name: "Analytics" })).toHaveAttribute("href", "/analytics");
    expect(screen.getByRole("link", { name: "About" })).toHaveAttribute("href", "#how-it-works");
    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login");
  });

  it("search opens, then submits the URL-encoded text to /discover?q=", () => {
    renderNavbar();
    fireEvent.click(screen.getByRole("button", { name: "Search places" }));
    const input = screen.getByRole("searchbox", { name: "Search food places" });
    fireEvent.change(input, { target: { value: "  char koay & teow " } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(screen.getByTestId("where")).toHaveTextContent("/discover?q=char%20koay%20%26%20teow");
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  });

  it("Escape closes the search box", () => {
    renderNavbar();
    fireEvent.click(screen.getByRole("button", { name: "Search places" }));
    expect(screen.getByRole("searchbox")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  });

  it("shows the saved places count", () => {
    window.localStorage.setItem(STORAGE_KEYS.savedPlaces, JSON.stringify(["x", "y"]));
    renderNavbar();
    expect(screen.getByRole("link", { name: "Saved places (2)" })).toHaveAttribute(
      "href",
      "/discover?saved=1",
    );
  });

  it("Escape on the open menu returns focus to the menu button", () => {
    renderNavbar();
    const menu = screen.getByRole("button", { name: "Menu" });
    fireEvent.click(menu);
    screen.getByRole("link", { name: "Discover" }).focus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(document.activeElement).toBe(menu);
  });

  it("Escape on the open search returns focus to the search button", () => {
    renderNavbar();
    fireEvent.click(screen.getByRole("button", { name: "Search places" }));
    expect(document.activeElement).toBe(screen.getByRole("searchbox"));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Search places" }));
  });

  it("a click outside the top bar closes the menu", () => {
    renderNavbar();
    const menu = screen.getByRole("button", { name: "Menu" });
    fireEvent.click(menu);
    fireEvent.pointerDown(screen.getByTestId("where"));
    expect(menu).toHaveAttribute("aria-expanded", "false");
  });

  it("the menu closes when the window grows to desktop width", () => {
    const listeners = new Set();
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query) => ({
        matches: false,
        media: query,
        addEventListener: (_type, fn) => listeners.add(fn),
        removeEventListener: (_type, fn) => listeners.delete(fn),
      })),
    );
    renderNavbar();
    const menu = screen.getByRole("button", { name: "Menu" });
    fireEvent.click(menu);
    act(() => listeners.forEach((fn) => fn({ matches: true })));
    expect(menu).toHaveAttribute("aria-expanded", "false");
  });
});
