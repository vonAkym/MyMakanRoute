// Test helpers: a fake fetch and a render wrapper with router + providers.

import { vi } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "../context/AuthContext";
import { TripBasketProvider } from "../context/TripBasketContext";

// routes: { "GET /api/x": { status, body } | (url, init) => ({ status, body }) }
// Unknown URLs answer 404 like the backend's notFound middleware.
export function mockFetch(routes) {
  const fn = vi.fn(async (url, init = {}) => {
    const method = init.method ?? "GET";
    const path = new URL(url).pathname;
    const handler = routes[`${method} ${path}`];
    const answer =
      typeof handler === "function"
        ? handler(url, init)
        : (handler ?? {
            status: 404,
            body: { success: false, error: { code: "NOT_FOUND", message: "Route not found" } },
          });
    return {
      ok: answer.status >= 200 && answer.status < 300,
      status: answer.status,
      json: async () => answer.body,
    };
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

export const ok = (data) => ({ status: 200, body: { success: true, data } });

export function renderWithProviders(ui, { route = "/" } = {}) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AuthProvider>
        <TripBasketProvider>{ui}</TripBasketProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}
