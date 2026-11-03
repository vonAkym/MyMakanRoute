// Route Planner: plans the visiting order and route for a food hopping trip.
//
// Steps of planRoute():
//   1. Load the chosen places from the database (404 if any is missing).
//   2. Snap each place to the road graph and build the travel time matrix with Dijkstra.
//   3. Choose the visiting order with Ant Colony Optimisation (ACO).
//   4. For comparison, also compute nearest-neighbour and (up to 8 stops) brute-force orders.
//   5. Build the legs (time, distance, path to draw on a map) of the ACO order.

const { AppError } = require("../../lib/response");
const model = require("./model");
const { buildTimeMatrix } = require("./dijkstra");
const { planVisitingOrderACO, DEFAULT_ACO } = require("./antColony");
const {
  nearestNeighbourOrder,
  bruteForceOrder,
  BRUTE_FORCE_MAX_STOPS,
} = require("./routeBaselines");

// Runs fn and returns its result together with how long it took in milliseconds.
function timed(fn) {
  const t0 = process.hrtime.bigint();
  const result = fn();
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  return { result, ms: Math.round(ms * 100) / 100 };
}

const round1 = (x) => Math.round(x * 10) / 10;

async function planRoute({ placeIds, travelMode = "walking", startPlaceId, seed }) {
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

  // 3. ACO visiting order.
  const aco = timed(() =>
    planVisitingOrderACO(matrix.timeS, { startIndex, seed: seed ?? DEFAULT_ACO.seed }),
  );

  // 4. Baselines for comparison.
  const nn = timed(() => nearestNeighbourOrder(matrix.timeS, startIndex));
  const brute =
    places.length <= BRUTE_FORCE_MAX_STOPS
      ? timed(() => bruteForceOrder(matrix.timeS, startIndex))
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

  const summary = (r, ms) => ({
    order: r.order.map((i) => places[i].id),
    totalTimeS: round1(r.totalTime),
    runtimeMs: ms,
  });
  const { params } = aco.result;

  return {
    travelMode,
    order: order.map((i) => ({
      ...places[i],
      snapDistanceM: Math.round(matrix.snaps[i].distanceM),
    })),
    legs,
    totalTimeS: round1(aco.result.totalTime),
    totalDistanceM: Math.round(totalDistanceM),
    comparison: {
      aco: summary(aco.result, aco.ms),
      nearestNeighbour: summary(nn.result, nn.ms),
      bruteForce: brute ? summary(brute.result, brute.ms) : null,
    },
    algorithm: {
      name: "ant-colony-optimisation",
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
