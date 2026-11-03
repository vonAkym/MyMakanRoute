// Small fetch wrapper for the MyMakanRoute backend.
// Every backend answer looks like { success: true, data } or
// { success: false, error: { code, message, details } }. This file unwraps `data`
// and turns failures into an ApiError with a friendly message.

export const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:3000").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(message, { code = "UNKNOWN_ERROR", status = 0, details } = {}) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

// Builds "?a=1&b=2", skipping empty values (undefined, null, "", empty arrays).
export function toQueryString(params = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      if (value.length > 0) search.set(key, value.join(","));
    } else {
      search.set(key, String(value));
    }
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

// path: "/api/..." ; options: { method, body, query, signal }
export async function apiRequest(path, { method = "GET", body, query, signal } = {}) {
  const url = `${API_URL}${path}${toQueryString(query)}`;
  let response;
  try {
    response = await fetch(url, {
      method,
      signal,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (err) {
    if (err?.name === "AbortError") throw err;
    throw new ApiError(
      "Cannot reach the MyMakanRoute server. Check that the backend is running and try again.",
      { code: "NETWORK_ERROR" },
    );
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    // Not JSON (e.g. an HTML error page from a proxy). Handled below.
  }

  if (response.ok && payload?.success === true) return payload.data;

  const error = payload?.error;
  throw new ApiError(error?.message || `The server answered with an error (${response.status}).`, {
    code: error?.code || "HTTP_ERROR",
    status: response.status,
    details: error?.details,
  });
}
