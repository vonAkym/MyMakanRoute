// Reviews carousel: arrows, dots, keys, swipe, live region, and the 1 / 2 / 3 per view
// layouts. Without a matchMedia stub (plain jsdom) it shows 1 card: 6 positions.
import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import Testimonials, { averageRating, positionText } from "./Testimonials";
import { TESTIMONIALS } from "../../data/landingContent";

const carousel = () => screen.getByRole("region", { name: "Food hopper reviews" });
const live = () => carousel().querySelector("[aria-live='polite']");
const dots = () => screen.getAllByRole("button", { name: /^Go to review/ });
const next = () => screen.getByRole("button", { name: "Next review" });
const prev = () => screen.getByRole("button", { name: "Previous review" });

// matchMedia stub whose answers can change later (to simulate resizing the window).
function stubWidth(initialWidth) {
  let width = initialWidth;
  const listeners = new Set();
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query) => {
      const min = Number(/min-width:\s*(\d+)px/.exec(query)?.[1] ?? NaN);
      return {
        get matches() {
          return Number.isFinite(min) && width >= min;
        },
        media: query,
        addEventListener: (_type, fn) => listeners.add(fn),
        removeEventListener: (_type, fn) => listeners.delete(fn),
      };
    }),
  );
  return (newWidth) => {
    width = newWidth;
    act(() => listeners.forEach((fn) => fn()));
  };
}

describe("Testimonials helpers", () => {
  it("averageRating rounds to 1 decimal", () => {
    expect(averageRating([{ rating: 5 }, { rating: 4 }, { rating: 5 }])).toBe(4.7);
    expect(averageRating([])).toBe(0);
  });

  it("positionText names one review or a range", () => {
    expect(positionText(1, 1, 6)).toBe("Review 2 of 6");
    expect(positionText(1, 3, 6)).toBe("Reviews 2–4 of 6");
  });
});

describe("Testimonials carousel (phone: 1 per view)", () => {
  it("is a labelled carousel with 6 labelled slides and a SAMPLE note", () => {
    render(<Testimonials />);
    expect(carousel()).toHaveAttribute("aria-roledescription", "carousel");
    expect(screen.getAllByRole("group", { hidden: true })).toHaveLength(6);
    expect(screen.getByText("Sample")).toBeInTheDocument();
  });

  it("shows the average computed from the sample ratings", () => {
    render(<Testimonials />);
    const expected = averageRating(TESTIMONIALS.items).toFixed(1);
    expect(screen.getByText(expected, { selector: ".lp-reviews__average" })).toBeInTheDocument();
  });

  it("arrows move one review and update the live region", () => {
    render(<Testimonials />);
    expect(prev()).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(next());
    expect(live()).toHaveTextContent("Review 2 of 6");
    expect(dots()[1]).toHaveAttribute("aria-current", "true");
    expect(prev()).not.toHaveAttribute("aria-disabled");
    fireEvent.click(prev());
    expect(live()).toHaveTextContent("Review 1 of 6");
  });

  it("keeps keyboard focus on Next when it reaches the end", () => {
    render(<Testimonials />);
    next().focus();
    for (let i = 0; i < 8; i++) fireEvent.click(next()); // Enter on a button = click
    expect(document.activeElement).toBe(next());
    expect(next()).toHaveAttribute("aria-disabled", "true");
    expect(next()).not.toBeDisabled();
    expect(live()).toHaveTextContent("Review 6 of 6");
  });

  it("dots jump to a review", () => {
    render(<Testimonials />);
    expect(dots()).toHaveLength(6);
    fireEvent.click(dots()[5]);
    expect(live()).toHaveTextContent("Review 6 of 6");
    expect(next()).toHaveAttribute("aria-disabled", "true");
  });

  it("Left and Right keys work when the carousel has focus", () => {
    render(<Testimonials />);
    fireEvent.keyDown(carousel(), { key: "ArrowRight" });
    fireEvent.keyDown(carousel(), { key: "ArrowRight" });
    expect(live()).toHaveTextContent("Review 3 of 6");
    fireEvent.keyDown(carousel(), { key: "ArrowLeft" });
    expect(live()).toHaveTextContent("Review 2 of 6");
  });

  it("a swipe of 50px or more moves; a short one does not", () => {
    render(<Testimonials />);
    const viewport = carousel().querySelector(".lp-carousel__viewport");

    fireEvent.pointerDown(viewport, { pointerType: "touch", clientX: 200, clientY: 100 });
    fireEvent.pointerUp(viewport, { pointerType: "touch", clientX: 170, clientY: 100 });
    expect(dots()[0]).toHaveAttribute("aria-current", "true");

    fireEvent.pointerDown(viewport, { pointerType: "touch", clientX: 300, clientY: 100 });
    fireEvent.pointerUp(viewport, { pointerType: "touch", clientX: 220, clientY: 104 });
    expect(live()).toHaveTextContent("Review 2 of 6");

    fireEvent.pointerDown(viewport, { pointerType: "touch", clientX: 100, clientY: 100 });
    fireEvent.pointerUp(viewport, { pointerType: "touch", clientX: 200, clientY: 100 });
    expect(live()).toHaveTextContent("Review 1 of 6");
  });
});

describe("Testimonials carousel (wider screens)", () => {
  it("desktop (1024px+): 3 per view, 4 positions, stops at Reviews 4–6", () => {
    stubWidth(1440);
    render(<Testimonials />);
    expect(dots()).toHaveLength(4);
    for (let i = 0; i < 5; i++) fireEvent.click(next());
    expect(live()).toHaveTextContent("Reviews 4–6 of 6");
    expect(next()).toHaveAttribute("aria-disabled", "true");
  });

  it("tablet (640px+): 2 per view, 5 positions", () => {
    stubWidth(800);
    render(<Testimonials />);
    expect(dots()).toHaveLength(5);
    fireEvent.click(next());
    expect(live()).toHaveTextContent("Reviews 2–3 of 6");
  });

  it("keeps the index in range after the window grows", () => {
    const resize = stubWidth(390);
    render(<Testimonials />);
    fireEvent.click(dots()[5]); // last review on a phone
    resize(1440); // now 3 per view: the last valid position is 4 (index 3)
    expect(dots()).toHaveLength(4);
    expect(dots()[3]).toHaveAttribute("aria-current", "true");
    expect(next()).toHaveAttribute("aria-disabled", "true");
    // Going back from the clamped state moves to position 3, not 5.
    fireEvent.click(prev());
    expect(live()).toHaveTextContent("Reviews 3–5 of 6");
  });
});
