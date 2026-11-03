// Runs before every test file: adds jest-dom matchers (toBeInTheDocument, ...) and
// cleans up between tests. Tests never use the network: fetch is mocked per test.
import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// jsdom has no ResizeObserver (Recharts uses it) and no scrollTo.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = globalThis.ResizeObserver ?? ResizeObserverStub;
window.scrollTo = () => {};
