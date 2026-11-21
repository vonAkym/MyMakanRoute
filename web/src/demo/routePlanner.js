// DEMO COPY of the Route Planner (backend/src/modules/food-hopping/service.js, dijkstra.js and
// the fallback graph in travelGraph.js), as an ES module. Used only by the GitHub Pages demo.
//
// Opening hours are used as time windows, as in the backend (timeWindows.js).
// The real road map (data/road-graph-penang.json) is too big to ship to the browser, so the
// demo always uses the backend's FALLBACK travel graph: each stop is linked to its 4 nearest
// stops, and the road distance is estimated as straight-line distance x 1.3. Dijkstra, Ant
// Colony Optimisation, nearest neighbour and brute force are the same as in the backend.

import { ApiError } from "../api/client.js";
import { DEMO_PLACES, haversineMeters } from "./places.js";
import { planVisitingOrderACO, DEFAULT_ACO } from "./antColony.js";
import {
  nearestNeighbourOrder,
  bruteForceOrder,
  bruteForceScheduleOrder,
  BRUTE_FORCE_MAX_STOPS,
} from "./routeBaselines.js";
import {
  windowsFor,
  simulateSchedule,
  localDayAndSeconds,
  formatClock,
  toSeconds,
  DEFAULT_VISIT_S,
} from "./timeWindows.js";

export const MIN_STOPS = 2;
export const MAX_STOPS = 10;
const FALLBACK_K = 4;
const FALLBACK_DETOUR_FACTOR = 1.3;
const WALKING_MPS = 1.4; // about 5 km/h
const DRIVING_MPS = 20 / 3.6; // 20 km/h, the backend's default road speed
const GRAPH_SOURCE = "Demo estimate (straight line x 1.3)";

const round1 = (x) => Math.round(x * 10) / 10;
const round6 = (x) => Math.round(x * 1e6) / 1e6;

// k-nearest-neighbour graph between the stops: adj[i] = [{ to, timeS, distM }].
export function buildKnnGraph(stops, mode, k = FALLBACK_K) {
  const speed = mode === "driving" ? DRIVING_MPS : WALKING_MPS;
  const adj = stops.map(() => []);
  const linked = new Set();
  stops.forEach((p, i) => {
    const nearest = stops
      .map((q, j) => ({ j, d: haversineMeters(p.lat, p.lng, q.lat, q.lng) }))
      .filter(({ j }) => j !== i)
      .sort((a, b) => a.d - b.d)
      .slice(0, k);
    for (const { j, d } of nearest) {
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (linked.has(key)) continue; // two-way edge already added from the other side
      linked.add(key);
      const distM = d * FALLBACK_DETOUR_FACTOR;
      adj[i].push({ to: j, timeS: distM / speed, distM });
      adj[j].push({ to: i, timeS: distM / speed, distM });
    }
  });
  return adj;
}

// Dijkstra from `source`: quickest time and distance to every node, plus `prev` to rebuild
// the route. The demo graph has at most 10 nodes, so a simple array scan replaces the heap.
export function shortestTravelTime(adj, source) {
  const n = adj.length;
  const time = new Array(n).fill(Infinity);
  const dist = new Array(n).fill(Infinity);
  const prev = new Array(n).fill(-1);
  const settled = new Array(n).fill(false);
  time[source] = 0;
  dist[source] = 0;
  for (;;) {
    let u = -1;
    for (let v = 0; v < n; v++) {
      if (!settled[v] && time[v] < Infinity && (u === -1 || time[v] < time[u])) u = v;
    }
    if (u === -1) break;
    settled[u] = true;
    for (const { to, timeS, distM } of adj[u]) {
      if (!settled[to] && time[u] + timeS < time[to]) {
        time[to] = time[u] + timeS;
        dist[to] = dist[u] + distM;
        prev[to] = u;
      }
    }
  }
  return { time, dist, prev };
}

// Time matrix (s), distance matrix (m) and paths between every pair of stops.
export function buildTimeMatrix(stops, mode) {
  const adj = buildKnnGraph(stops, mode);
  const runs = stops.map((_, i) => shortestTravelTime(adj, i));
  const pathBetween = (i, j) => {
    const nodes = [];
    for (let v = j; v !== -1; v = runs[i].prev[v]) nodes.unshift(v);
    return nodes.map((v) => [round6(stops[v].lat), round6(stops[v].lng)]);
  };
  return {
    timeS: runs.map((r) => r.time),
    distanceM: runs.map((r) => r.dist),
    pathBetween,
    nodeCount: stops.length,
    edgeCount: adj.reduce((s, list) => s + list.length, 0) / 2,
  };
}

function timed(fn) {
  const t0 = performance.now();
  const result = fn();
  return { result, ms: Math.round((performance.now() - t0) * 100) / 100 };
}

// Same checks as planRouteSchema in backend/src/modules/food-hopping/routes.js.
function checkBody(body) {
  const fail = (message) => {
    throw new ApiError(message, { code: "VALIDATION_ERROR", status: 400 });
  };
  const ids = body?.placeIds;
  if (!Array.isArray(ids)) fail("placeIds is required");
  if (ids.length < MIN_STOPS) fail(`choose at least ${MIN_STOPS} places`);
  if (ids.length > MAX_STOPS) fail(`choose at most ${MAX_STOPS} places`);
  if (new Set(ids).size !== ids.length) fail("placeIds must not repeat");
  const travelMode = body.travelMode ?? "walking";
  if (!["walking", "driving"].includes(travelMode)) fail("travelMode must be walking or driving");
  if (body.startPlaceId !== undefined && !ids.includes(body.startPlaceId)) {
    fail("startPlaceId must be one of placeIds");
  }
  if (
    body.day !== undefined &&
    !["mon", "tue", "wed", "thu", "fri", "sat", "sun"].includes(body.day)
  ) {
    fail("day must be mon to sun");
  }
  if (body.startTime !== undefined && toSeconds(body.startTime) === null) {
    fail("startTime must look like 09:30");
  }
  return travelMode;
}

// Same answer shape as POST /api/hopping/route.
export function planRoute(body) {
  const travelMode = checkBody(body);
  const { placeIds, startPlaceId, seed, day, startTime, visitMinutes } = body;

  // 1. Places, in the order the user chose them.
  const byId = new Map(DEMO_PLACES.map((p) => [p.id, p]));
  const missing = placeIds.filter((id) => !byId.has(id));
  if (missing.length > 0) {
    throw new ApiError("Some places were not found", {
      code: "NOT_FOUND",
      status: 404,
      details: { missing },
    });
  }
  const places = placeIds.map((id) => {
    const p = byId.get(id);
    return {
      id: p.id,
      name: p.name,
      lat: p.lat,
      lng: p.lng,
      cuisine: p.cuisine,
      avg_rating: p.avg_rating,
      review_count: p.review_count,
      is_sample: true,
      opening_hours: p.opening_hours,
    };
  });
  const startIndex = startPlaceId ? placeIds.indexOf(startPlaceId) : 0;

  // 2. Time matrix with Dijkstra on the estimated graph.
  const { result: matrix, ms: matrixMs } = timed(() => buildTimeMatrix(places, travelMode));
  const unreachable = [];
  matrix.timeS.forEach((row, i) =>
    row.forEach((t, j) => {
      if (!Number.isFinite(t)) unreachable.push({ from: places[i].id, to: places[j].id });
    }),
  );
  if (unreachable.length > 0) {
    throw new ApiError("No route between some places", {
      code: "ROUTE_UNREACHABLE",
      status: 422,
      details: { unreachable },
    });
  }

  // 3. Opening hours as time windows (same as the backend service).
  const now = localDayAndSeconds();
  const schedule = {
    startS: startTime ? toSeconds(startTime) : now.seconds,
    visitS: visitMinutes ? visitMinutes * 60 : DEFAULT_VISIT_S,
    windows: places.map((p) => windowsFor(p.opening_hours, day ?? now.day)),
  };
  const useTimeWindows = schedule.windows.some((w) => w !== null);

  // 4. ACO order, 5. baselines for comparison.
  const aco = timed(() =>
    planVisitingOrderACO(matrix.timeS, {
      startIndex,
      seed: seed ?? DEFAULT_ACO.seed,
      schedule: useTimeWindows ? schedule : undefined,
    }),
  );
  const nn = timed(() => nearestNeighbourOrder(matrix.timeS, startIndex));
  const brute =
    places.length <= BRUTE_FORCE_MAX_STOPS
      ? timed(() =>
          useTimeWindows
            ? bruteForceScheduleOrder(matrix.timeS, startIndex, schedule)
            : bruteForceOrder(matrix.timeS, startIndex),
        )
      : null;

  // 5. Legs of the ACO order.
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
    order: order.map((i, k) => ({
      ...places[i],
      snapDistanceM: 0,
      arrivalTime: formatClock(timetable.stops[k].arriveS),
      waitS: round1(timetable.stops[k].waitS),
      closedOnArrival: timetable.stops[k].closed,
      hasOpeningHours: schedule.windows[i] !== null,
    })),
    schedule: {
      day: day ?? now.day,
      startTime: formatClock(schedule.startS),
      visitMinutes: schedule.visitS / 60,
      endTime: formatClock(schedule.startS + timetable.durationS),
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
    graph: { source: GRAPH_SOURCE, nodes: matrix.nodeCount, edges: matrix.edgeCount },
  };
}
