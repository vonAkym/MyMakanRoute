// Landing page: fade + slide-up when a section scrolls into view.
// Content is VISIBLE by default. The element is hidden (data-reveal="hidden") only after
// we know IntersectionObserver exists and the user allows motion, so nothing disappears
// in tests, in old browsers or if JavaScript fails. IntersectionObserver is a browser
// feature that tells us when an element enters the screen (no library needed).

import { useEffect, useRef } from "react";
import useReducedMotion from "./useReducedMotion";

export default function useRevealOnScroll() {
  const ref = useRef(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el || reducedMotion || typeof window.IntersectionObserver !== "function") {
      if (el) el.removeAttribute("data-reveal");
      return undefined;
    }

    // Already on screen when the page opens: leave it visible (no fade for what you see first).
    if (el.getBoundingClientRect().top < window.innerHeight) {
      el.removeAttribute("data-reveal");
      return undefined;
    }

    el.setAttribute("data-reveal", "hidden");
    const observer = new window.IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            el.setAttribute("data-reveal", "shown");
            observer.disconnect(); // reveal once, then stop watching
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [reducedMotion]);

  return ref;
}
