// Route Planner: opening hours as TIME WINDOWS.
//
// A food trip is more than the shortest path: each stall is open only at certain times.
// Each stop therefore has a time window (opening ranges for the trip day). Walking the
// visiting order hour by hour gives, for every stop:
//   - arrival time,
//   - waiting time (arrived before it opens: wait until it opens),
//   - "closed on arrival" (arrived after it closed for the day).
// The cost of an order = total trip duration (travel + waiting + time spent eating)
//                        + a 2-hour penalty for every stop that is closed on arrival
//                        + how late we were at those stops.
// This turns the plain shortest-order problem into the "travelling salesman problem with
// time windows", which ACO handles well and brute force cannot handle beyond a few stops.
// Places without day-by-day opening hours are treated as always open.
// All times are seconds from midnight of the trip day (Malaysian time).

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const DAY_S = 24 * 3600;
const DEFAULT_VISIT_S = 30 * 60; // time spent eating at each stop
const CLOSED_PENALTY_S = 2 * 3600;

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

// "18:30" -> 66600 seconds, or null.
function toSeconds(text) {
  const match = TIME_PATTERN.exec(String(text ?? ""));
  return match ? Number(match[1]) * 3600 + Number(match[2]) * 60 : null;
}

function rangesOf(openingHours, day) {
  const ranges = Array.isArray(openingHours?.[day]) ? openingHours[day] : [];
  const out = [];
  for (const range of ranges) {
    if (!Array.isArray(range) || range.length !== 2) continue;
    const start = toSeconds(range[0]);
    let end = toSeconds(range[1]);
    if (start === null || end === null) continue;
    if (range[1] === "23:59") end = DAY_S; // "23:59" means until midnight
    out.push([start, end]);
  }
  return out;
}

// Opening windows of one place on one day, sorted, as [[startS, endS], ...].
// Returns null when the place has no day-by-day hours (always open).
// A range past midnight (18:00-02:00) becomes [64800, 93600]; yesterday's late range
// adds the early hours of today ([0, 7200]).
function windowsFor(openingHours, day) {
  if (!openingHours || !DAY_KEYS.some((d) => Array.isArray(openingHours[d]))) return null;
  const yesterday = DAY_KEYS[(DAY_KEYS.indexOf(day) + 6) % 7];
  const windows = [];
  for (const [start, end] of rangesOf(openingHours, yesterday)) {
    if (end < start) windows.push([0, end]);
  }
  for (const [start, end] of rangesOf(openingHours, day)) {
    windows.push(end <= start ? [start, end + DAY_S] : [start, end]);
  }
  return windows.sort((a, b) => a[0] - b[0]);
}

// What happens when we arrive at a stop with these windows at arriveS.
// Returns { waitS, closed, slackS (time left before it closes), lateS }.
function arriveAt(windows, arriveS) {
  if (windows === null) return { waitS: 0, closed: false, slackS: Infinity, lateS: 0 };
  const open = windows.find(([, end]) => arriveS < end);
  if (!open) {
    const lastEnd = windows.length > 0 ? Math.max(...windows.map((w) => w[1])) : arriveS;
    return { waitS: 0, closed: true, slackS: 0, lateS: Math.max(0, arriveS - lastEnd) };
  }
  const waitS = Math.max(0, open[0] - arriveS);
  return { waitS, closed: false, slackS: open[1] - (arriveS + waitS), lateS: 0 };
}

// Walks a visiting order. schedule: { startS, visitS, windows: [windows | null per stop] }.
// Returns { travelS, waitS, durationS, closedStops, lateS, cost, stops: [...] }.
function simulateSchedule(matrix, order, schedule) {
  const visitS = schedule.visitS ?? DEFAULT_VISIT_S;
  let t = schedule.startS;
  let travelS = 0;
  let waitS = 0;
  let closedStops = 0;
  let lateS = 0;
  const stops = [];
  for (let k = 0; k < order.length; k++) {
    const i = order[k];
    if (k > 0) {
      const leg = matrix[order[k - 1]][i];
      travelS += leg;
      t += leg;
    }
    const arrival = arriveAt(schedule.windows[i], t);
    const arriveS = t;
    waitS += arrival.waitS;
    if (arrival.closed) {
      closedStops += 1;
      lateS += arrival.lateS;
    } else {
      t += arrival.waitS + visitS; // no meal at a closed stall, so no eating time
    }
    stops.push({ index: i, arriveS, waitS: arrival.waitS, departS: t, closed: arrival.closed });
  }
  const durationS = t - schedule.startS;
  const cost = durationS + CLOSED_PENALTY_S * closedStops + lateS;
  return { travelS, waitS, durationS, closedStops, lateS, cost, stops };
}

// "Asia/Kuala_Lumpur" day key and seconds from midnight for a Date.
function localDayAndSeconds(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kuala_Lumpur",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type).value;
  return {
    day: get("weekday").toLowerCase().slice(0, 3),
    seconds: Number(get("hour")) * 3600 + Number(get("minute")) * 60,
  };
}

// 66600 -> "18:30" (times after midnight wrap: 90000 -> "01:00").
function formatClock(seconds) {
  const s = (((Math.round(seconds / 60) * 60) % DAY_S) + DAY_S) % DAY_S;
  const h = String(Math.floor(s / 3600)).padStart(2, "0");
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  return `${h}:${m}`;
}

module.exports = {
  windowsFor,
  arriveAt,
  simulateSchedule,
  localDayAndSeconds,
  formatClock,
  toSeconds,
  DAY_KEYS,
  DEFAULT_VISIT_S,
  CLOSED_PENALTY_S,
};
