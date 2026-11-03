// Saved places: shared between components and kept in localStorage.
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import useSavedPlaces from "./useSavedPlaces";
import { STORAGE_KEYS } from "../lib/storage";

function Toggle({ id }) {
  const { isSaved, toggleSaved } = useSavedPlaces();
  return (
    <button type="button" aria-pressed={isSaved(id)} onClick={() => toggleSaved(id)}>
      {id}
    </button>
  );
}

function Count() {
  const { count } = useSavedPlaces();
  return <p>Count: {count}</p>;
}

describe("useSavedPlaces", () => {
  it("toggles an id, shares the count and saves to localStorage", () => {
    render(
      <>
        <Toggle id="a" />
        <Count />
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: "a" }));
    expect(screen.getByRole("button", { name: "a" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Count: 1")).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEYS.savedPlaces))).toEqual(["a"]);

    fireEvent.click(screen.getByRole("button", { name: "a" }));
    expect(screen.getByText("Count: 0")).toBeInTheDocument();
  });

  it("reads saved ids back after a re-mount (like a page refresh)", () => {
    window.localStorage.setItem(STORAGE_KEYS.savedPlaces, JSON.stringify(["b"]));
    render(<Toggle id="b" />);
    expect(screen.getByRole("button", { name: "b" })).toHaveAttribute("aria-pressed", "true");
  });

  it("ignores broken stored data", () => {
    window.localStorage.setItem(STORAGE_KEYS.savedPlaces, "{not json");
    render(<Count />);
    expect(screen.getByText("Count: 0")).toBeInTheDocument();
  });

  // Keep this test last: it switches the hook to its in-memory fallback for this file.
  it("still toggles for this visit when localStorage cannot be written", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    render(
      <>
        <Toggle id="c" />
        <Count />
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: "c" }));
    expect(screen.getByRole("button", { name: "c" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Count: 1")).toBeInTheDocument();
  });
});
