import { vi } from "vitest";
import { ApiError, API_URL, apiRequest, toQueryString } from "./client";
import { mockFetch, ok } from "../test/helpers";

describe("toQueryString", () => {
  test("skips empty values and joins arrays with commas", () => {
    expect(
      toQueryString({
        lat: 5.4,
        lng: 100.3,
        halal: undefined,
        cuisine: ["chinese", "malay"],
        x: "",
      }),
    ).toBe("?lat=5.4&lng=100.3&cuisine=chinese%2Cmalay");
    expect(toQueryString({ dietary: [] })).toBe("");
  });
});

describe("apiRequest", () => {
  test("unwraps { success, data } and sends the query string", async () => {
    const fetchFn = mockFetch({ "GET /api/thing": ok({ hello: "world" }) });
    await expect(apiRequest("/api/thing", { query: { a: 1 } })).resolves.toEqual({
      hello: "world",
    });
    expect(fetchFn).toHaveBeenCalledWith(`${API_URL}/api/thing?a=1`, expect.any(Object));
  });

  test("sends JSON bodies", async () => {
    const fetchFn = mockFetch({ "POST /api/thing": ok({ saved: true }) });
    await apiRequest("/api/thing", { method: "POST", body: { x: 1 } });
    const init = fetchFn.mock.calls[0][1];
    expect(init.headers).toEqual({ "Content-Type": "application/json" });
    expect(init.body).toBe('{"x":1}');
  });

  test("turns an error answer into ApiError with code, status and details", async () => {
    mockFetch({
      "GET /api/thing": {
        status: 400,
        body: {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "lat is required",
            details: [{ path: "lat" }],
          },
        },
      },
    });
    const err = await apiRequest("/api/thing").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({
      code: "VALIDATION_ERROR",
      status: 400,
      message: "lat is required",
      details: [{ path: "lat" }],
    });
  });

  test("a network failure gives a friendly NETWORK_ERROR", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    const err = await apiRequest("/api/thing").catch((e) => e);
    expect(err.code).toBe("NETWORK_ERROR");
    expect(err.message).toMatch(/Cannot reach the MyMakanRoute server/);
  });

  test("a non-JSON error page still gives a readable error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 502,
        json: async () => {
          throw new SyntaxError("Unexpected token <");
        },
      })),
    );
    const err = await apiRequest("/api/thing").catch((e) => e);
    expect(err).toMatchObject({ code: "HTTP_ERROR", status: 502 });
  });
});
