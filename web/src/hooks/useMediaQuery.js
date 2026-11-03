// Live value of a CSS media query, e.g. useMediaQuery("(min-width: 1024px)").
// Returns false where matchMedia does not exist (tests, very old browsers).

import { useSyncExternalStore } from "react";

export default function useMediaQuery(query) {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window.matchMedia !== "function") return () => {};
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => typeof window.matchMedia === "function" && window.matchMedia(query).matches,
    () => false,
  );
}
