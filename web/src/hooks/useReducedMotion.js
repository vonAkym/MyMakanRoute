// True when the user turned off animations in the system settings
// (Windows: Settings > Accessibility > Visual effects > Animation effects off).

import useMediaQuery from "./useMediaQuery";

export default function useReducedMotion() {
  return useMediaQuery("(prefers-reduced-motion: reduce)");
}
