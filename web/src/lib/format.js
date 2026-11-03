// Small display helpers shared by the pages.

export function formatDistance(metres) {
  if (metres == null || !Number.isFinite(Number(metres))) return "";
  const m = Number(metres);
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}

// Seconds -> "4 min" or "1 h 05 min".
export function formatDuration(seconds) {
  if (seconds == null || !Number.isFinite(Number(seconds))) return "";
  const totalMin = Math.max(1, Math.round(Number(seconds) / 60));
  if (totalMin < 60) return `${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const min = String(totalMin % 60).padStart(2, "0");
  return `${h} h ${min} min`;
}

// Seconds -> minutes with one decimal, for comparing algorithms.
export function toMinutes(seconds) {
  return Math.round((Number(seconds) / 60) * 10) / 10;
}

export function formatRating(rating) {
  return rating == null ? "No rating" : Number(rating).toFixed(1);
}

export const PRICE_LABELS = Object.freeze({
  1: "Budget",
  2: "Moderate",
  3: "Pricey",
  4: "Premium",
});

// 2 -> "RM RM" style symbol plus a readable word for screen readers.
export function formatPrice(level) {
  if (!level) return { symbol: "", text: "Price unknown" };
  return { symbol: "RM".repeat(level), text: `${PRICE_LABELS[level]} (price level ${level} of 4)` };
}

export function formatHalal(isHalal) {
  if (isHalal === true) return "Halal";
  if (isHalal === false) return "Not halal";
  return "Halal unknown";
}

export function capitalise(text) {
  if (!text) return "";
  return String(text).replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatDateTime(iso) {
  try {
    return new Date(iso).toLocaleString("en-MY", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAY_NAMES = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

// {"mon":[["08:00","15:00"]], ...} -> [{ day: "Monday", text: "08:00 to 15:00" }, ...]
// Returns [] when there are no structured hours (the raw OSM string is shown instead).
export function formatOpeningHours(openingHours) {
  if (!openingHours || typeof openingHours !== "object") return [];
  const hasDays = DAY_KEYS.some((d) => Array.isArray(openingHours[d]));
  if (!hasDays) return [];
  return DAY_KEYS.map((d) => {
    const ranges = openingHours[d];
    const text =
      Array.isArray(ranges) && ranges.length > 0
        ? ranges
            .map(([from, to]) =>
              from === "00:00" && to === "23:59" ? "Open 24 hours" : `${from} to ${to}`,
            )
            .join(", ")
        : "Closed";
    return { day: DAY_NAMES[d], text };
  });
}
