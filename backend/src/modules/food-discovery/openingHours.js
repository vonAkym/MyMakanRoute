// Food Place Searching: "open now" check on structured opening hours.
// Format (see db/migrations/001_places.sql):
//   {"mon":[["08:00","15:00"],["18:00","22:00"]], "tue":[...], ..., "osm":"<original OSM text>"}
// A missing day means closed that day. Only the "osm" text (no day keys) means we cannot tell.

const TIME_ZONE = "Asia/Kuala_Lumpur";
const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

// "08:30" -> 510 (minutes after midnight); anything else -> null.
function toMinutes(text) {
  const match = TIME_PATTERN.exec(text);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

// Day key ("mon") and minutes after midnight for `date` in Malaysian time.
function localDayAndMinutes(date, timeZone = TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type).value;
  return {
    day: get("weekday").toLowerCase().slice(0, 3),
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

// True when the place has at least one day key, i.e. hours we can actually check.
function hasStructuredHours(openingHours) {
  if (!openingHours || typeof openingHours !== "object") return false;
  return DAYS.some((d) => Array.isArray(openingHours[d]));
}

// Ranges for one day as [start, end] minutes, skipping badly formed entries.
// "23:59" as a closing time means "until midnight", so it becomes 24:00.
function rangesFor(openingHours, day) {
  const ranges = Array.isArray(openingHours[day]) ? openingHours[day] : [];
  const out = [];
  for (const range of ranges) {
    if (!Array.isArray(range) || range.length !== 2) continue;
    const start = toMinutes(range[0]);
    let end = toMinutes(range[1]);
    if (start === null || end === null) continue;
    if (end === 23 * 60 + 59) end = 24 * 60;
    out.push([start, end]);
  }
  return out;
}

// Is the place open at `date`? Places without structured hours count as NOT open,
// because we cannot promise they are.
function isOpenAt(openingHours, date = new Date()) {
  if (!hasStructuredHours(openingHours)) return false;
  const { day, minutes } = localDayAndMinutes(date);
  const yesterday = DAYS[(DAYS.indexOf(day) + 6) % 7];

  for (const [start, end] of rangesFor(openingHours, day)) {
    if (start < end && minutes >= start && minutes < end) return true;
    // A range like 18:00-02:00 runs past midnight: open from start until midnight today.
    if (start > end && minutes >= start) return true;
  }
  // ...and yesterday's past-midnight range is still open early this morning.
  for (const [start, end] of rangesFor(openingHours, yesterday)) {
    if (start > end && minutes < end) return true;
  }
  return false;
}

module.exports = { TIME_ZONE, isOpenAt, hasStructuredHours, localDayAndMinutes };
