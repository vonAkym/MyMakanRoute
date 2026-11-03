// Reveal on scroll: content must stay visible unless the hook is sure it can animate.
import { describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import useRevealOnScroll from "./useRevealOnScroll";

function Box() {
  const ref = useRevealOnScroll();
  return (
    <div ref={ref} data-testid="box">
      Hello
    </div>
  );
}

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

// Fake IntersectionObserver that lets the test say "now it is on screen".
function stubIntersectionObserver() {
  const instances = [];
  class FakeObserver {
    constructor(callback) {
      this.callback = callback;
      this.disconnect = vi.fn();
      instances.push(this);
    }
    observe(el) {
      this.el = el;
    }
    enter() {
      this.callback([{ isIntersecting: true, target: this.el }]);
    }
  }
  vi.stubGlobal("IntersectionObserver", FakeObserver);
  return instances;
}

describe("useRevealOnScroll", () => {
  it("keeps content visible when IntersectionObserver does not exist", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    render(<Box />);
    expect(screen.getByTestId("box")).not.toHaveAttribute("data-reveal");
  });

  it("keeps content visible when the user prefers reduced motion", () => {
    stubMatchMedia(["(prefers-reduced-motion: reduce)"]);
    const observers = stubIntersectionObserver();
    render(<Box />);
    expect(screen.getByTestId("box")).not.toHaveAttribute("data-reveal");
    expect(observers).toHaveLength(0);
  });

  it("keeps content visible when it is already on screen", () => {
    const observers = stubIntersectionObserver();
    render(<Box />);
    expect(screen.getByTestId("box")).not.toHaveAttribute("data-reveal");
    expect(observers).toHaveLength(0);
  });

  it("hides, then shows the element when it scrolls into view", () => {
    const observers = stubIntersectionObserver();
    // Pretend the element starts below the screen.
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({ top: 5000 });
    render(<Box />);
    const box = screen.getByTestId("box");
    expect(box).toHaveAttribute("data-reveal", "hidden");

    act(() => observers[0].enter());
    expect(box).toHaveAttribute("data-reveal", "shown");
    expect(observers[0].disconnect).toHaveBeenCalled();
  });
});
