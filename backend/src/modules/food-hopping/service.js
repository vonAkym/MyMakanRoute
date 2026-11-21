// Route Planner: plans the visiting order and route for a food hopping trip.
//
// Steps of planRoute():
//   1. Load the chosen places from the database (404 if any is missing).
//   2. Snap each place to the road graph and build the travel time matrix with Dijkstra.
//   3. Turn opening hours into time windows for the trip day and start time.
//   4. Choose the visiting order with Ant Colony Optimisation (ACO). When at least one stop
//      has opening hours, ACO solves the problem WITH time windows (timeWindows.js):
//      shortest trip that reaches every stop while it is open.
//   5. For comparison, also compute nearest-neighbour (ignores opening hours) and (up to
//      8 stops) brute-force orders.
//   6. Build the legs (time, distance, path) and the timetable of the ACO order.

const { AppError } = require("../../lib/response");
const model = require("./model");
const { buildTimeMatrix } = require("./dijkstra");
const { planVisitingOrderACO, DEFAULT_ACO } = require("./antColony");
const {
  nearestNeighbourOrder,
  bruteForceOrder,
  bruteForceScheduleOrder,
  BRUTE_FORCE_MAX_STOPS,
} = require("./routeBaselines");
const {
  windowsFor,
  simulateSchedule,
  localDayAndSeconds,
  formatClock,
  toSeconds,
  DEFAULT_VISIT_S,
} = require("./timeWindows");

// Runs fn and returns its result together with how long it took in milliseconds.
function timed(fn) {
  const t0 = process.hrtime.bigint();
  const result = fn();
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  return { result, ms: Math.round(ms * 100) / 100 };
}

const round1 = (x) => Math.round(x * 10) / 10;

// Trip day and start time: given by the user, or "now" in Malaysian time.
function tripStart({ day, startTime }, now = new Date()) {
  const current = localDayAndSeconds(now);
  return {
    day: day ?? current.day,
    startS: startTime ? toSeconds(startTime) : current.seconds,
  };
}

async function planRoute({
  placeIds,
  travelMode = "walking",
  startPlaceId,
  seed,
  day,
  startTime,
  visitMinutes,
}) {
  // 1. Places, kept in the order the user chose them.
  const rows = await model.findPlacesForRoute(placeIds);
  const byId = new Map(rows.map((p) => [String(p.id).toLowerCase(), p]));
  const missing = placeIds.filter((id) => !byId.has(id));
  if (missing.length > 0) {
    throw new AppError(404, "NOT_FOUND", "Some places were not found", { missing });
  }
  const places = placeIds.map((id) => byId.get(id));
  const startIndex = startPlaceId ? placeIds.indexOf(startPlaceId) : 0;

  // 2. Time matrix (seconds) between every pair of places.
  const { result: matrix, ms: matrixMs } = timed(() =>
    buildTimeMatrix(
      places.map((p) => ({ lat: Number(p.lat), lng: Number(p.lng) })),
      travelMode,
    ),
  );
  const unreachable = [];
  matrix.timeS.forEach((row, i) =>
    row.forEach((t, j) => {
      if (!Number.isFinite(t)) unreachable.push({ from: places[i].id, to: places[j].id });
    }),
  );
  if (unreachable.length > 0) {
    throw new AppError(422, "ROUTE_UNREACHABLE", "No route between some places", {
      unreachable,
    });
  }

  // 3. Time windows from opening hours (null = no hours known, always open).
  const start = tripStart({ day, startTime });
  const schedule = {
    startS: start.startS,
    visitS: visitMinutes ? visitMinutes * 60 : DEFAULT_VISIT_S,
    windows: places.map((p) => windowsFor(p.opening_hours, start.day)),
  };
  const useTimeWindows = schedule.windows.some((w) => w !== null);

  // 4. ACO visiting order (with time windows when any opening hours are known).
  const aco = timed(() =>
    planVisitingOrderACO(matrix.timeS, {
      startIndex,
      seed: seed ?? DEFAULT_ACO.seed,
      schedule: useTimeWindows ? schedule : undefined,
    }),
  );

  // 5. Baselines for comparison. Brute force uses the same goal as ACO.
  const nn = timed(() => nearestNeighbourOrder(matrix.timeS, startIndex));
  const brute =
    places.length <= BRUTE_FORCE_MAX_STOPS
      ? timed(() =>
          useTimeWindows
            ? bruteForceScheduleOrder(matrix.timeS, startIndex, schedule)
            : bruteForceOrder(matrix.timeS, startIndex),
        )
      : null;

  // 6. Legs and timetable of the ACO order.
  const order = aco.result.order;
  const legs = [];
  for (let k = 1; k < order.length; k++) {
    const i = order[k - 1];
    const j = order[k];
    legs.push({
      fromPlaceId: places[i].id,
      toPlaceId: places[j].id,
      timeS: round1(matrix.timeS[i][j]),
      distanceM: Math.round(matrix.distanceM[i][j]),
      path: matrix.pathBetween(i, j),
    });
  }
  const totalDistanceM = order
    .slice(1)
    .reduce((sum, j, k) => sum + matrix.distanceM[order[k]][j], 0);

  // Every algorithm's order is checked against the same timetable, so the comparison shows
  // how many stops each one would reach after closing time.
  const summary = (r, ms) => {
    const sim = simulateSchedule(matrix.timeS, r.order, schedule);
    return {
      order: r.order.map((i) => places[i].id),
      totalTimeS: round1(r.totalTime),
      durationS: round1(sim.durationS),
      waitS: round1(sim.waitS),
      closedStops: sim.closedStops,
      runtimeMs: ms,
    };
  };
  const { params } = aco.result;
  const timetable = simulateSchedule(matrix.timeS, order, schedule);

  return {
    travelMode,
    order: order.map((i, k) => {
      const stop = timetable.stops[k];
      return {
        ...places[i],
        snapDistanceM: Math.round(matrix.snaps[i].distanceM),
        arrivalTime: formatClock(stop.arriveS),
        waitS: round1(stop.waitS),
        closedOnArrival: stop.closed,
        hasOpeningHours: schedule.windows[i] !== null,
      };
    }),
    schedule: {
      day: start.day,
      startTime: formatClock(start.startS),
      visitMinutes: schedule.visitS / 60,
      endTime: formatClock(start.startS + timetable.durationS),
      durationS: round1(timetable.durationS),
      waitS: round1(timetable.waitS),
      closedStops: timetable.closedStops,
      usesOpeningHours: useTimeWindows,
    },
    legs,
    totalTimeS: round1(aco.result.totalTime),
    totalDistanceM: Math.round(totalDistanceM),
    comparison: {
      aco: summary(aco.result, aco.ms),
      nearestNeighbour: summary(nn.result, nn.ms),
      bruteForce: brute ? summary(brute.result, brute.ms) : null,
    },
    algorithm: {
      name: useTimeWindows ? "ant-colony-optimisation-time-windows" : "ant-colony-optimisation",
      ants: params.ants,
      iterations: params.iterations,
      alpha: params.alpha,
      beta: params.beta,
      evaporation: params.evaporation,
      q: params.q,
      stagnationLimit: params.stagnationLimit,
      seed: params.seed,
      iterationsRun: aco.result.iterationsRun,
      bestFoundAtIteration: aco.result.bestFoundAtIteration,
      timeMatrixMs: matrixMs,
    },
    graph: { source: matrix.source, nodes: matrix.nodeCount, edges: matrix.edgeCount },
  };
}

module.exports = { planRoute };
