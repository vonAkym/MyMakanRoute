// Route Planner: Ant Colony Optimisation (ACO) chooses the order to visit the food stops.
//
// Idea: many simulated "ants" each build a full visiting order. At every step an ant picks the
// next stop at random, but stops that are (a) close by and (b) marked with more "pheromone"
// are more likely. After each round, pheromone evaporates a little everywhere, and every ant
// adds pheromone on the moves it used: more for shorter orders. Over many rounds the moves of
// short orders collect the most pheromone, so the ants converge on a short order.
// Pheromone is kept between a lower and an upper limit (as in the MAX-MIN Ant System) so the
// ants keep exploring a little instead of all copying the first good order.
// ACO is a heuristic: it usually, but not always, finds the best order. The service compares
// it with nearest neighbour and (for up to 8 stops) brute force.
//
// Route type: OPEN route. It starts at startIndex, visits every stop exactly once and does not
// return to the start (PLAN Q6). Input is the n x n travel time matrix (seconds) from Dijkstra.

const { orderTime, nearestNeighbourOrder } = require("./routeBaselines");

// Small seeded random number generator (mulberry32). Same seed -> same numbers, so results
// are repeatable in tests and in the demo. Returns a function giving numbers in [0, 1).
function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Default settings. They were chosen with a small benchmark (random 5-8 stop matrices compared
// with brute force): beta 2 with trail limits found the optimum in about 98-99% of cases,
// while beta 3 without trail limits got stuck on a worse order much more often.
const DEFAULT_ACO = Object.freeze({
  iterations: 200, // maximum rounds of ants
  alpha: 1, // weight of pheromone (learned experience)
  beta: 2, // weight of heuristic (prefer nearby stops)
  evaporation: 0.5, // share of pheromone that disappears each round (rho)
  q: 1, // amount of pheromone one ant spreads over its order
  trailMinRatio: 0.2, // lowest allowed pheromone, as a share of the highest (see step 4)
  stagnationLimit: 100, // stop early after this many rounds without a better order
  seed: 42,
  elitist: true, // extra pheromone for the best order so far (see step 3)
  trailLimits: true, // keep pheromone between tauMin and tauMax (see step 4)
});

// The plain "textbook" Ant System (Dorigo et al., 1996) for comparison in the feasibility
// study: beta 3, no elitist deposit and no trail limits. Everything else as DEFAULT_ACO.
const TEXTBOOK_ACO = Object.freeze({ beta: 3, elitist: false, trailLimits: false });

// Default number of ants: twice the number of stops, at least 10.
const defaultAnts = (n) => Math.max(10, 2 * n);

// Picks an index at random with probability proportional to weights[i] ("roulette wheel").
function rouletteSelect(weights, random) {
  let sum = 0;
  for (const w of weights) sum += w;
  if (!(sum > 0) || !Number.isFinite(sum)) {
    // All weights zero (should not happen with a valid matrix): take the first candidate.
    return 0;
  }
  let r = random() * sum;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r < 0) return i;
  }
  return weights.length - 1; // rounding safety
}

// One ant builds a complete open order starting at startIndex.
function buildAntOrder(matrix, pheromone, heuristic, startIndex, params, random) {
  const n = matrix.length;
  const visited = new Uint8Array(n);
  const order = [startIndex];
  visited[startIndex] = 1;
  let current = startIndex;

  while (order.length < n) {
    const candidates = [];
    const weights = [];
    for (let j = 0; j < n; j++) {
      if (visited[j]) continue;
      candidates.push(j);
      // Attractiveness = pheromone^alpha * (1/time)^beta
      weights.push(pheromone[current][j] ** params.alpha * heuristic[current][j] ** params.beta);
    }
    const next = candidates[rouletteSelect(weights, random)];
    order.push(next);
    visited[next] = 1;
    current = next;
  }
  return order;
}

// Main ACO function. Returns { order, totalTime, iterationsRun, bestFoundAtIteration, params }.
function planVisitingOrderACO(timeMatrix, options = {}) {
  const n = timeMatrix.length;
  const startIndex = options.startIndex ?? 0;
  const params = { ...DEFAULT_ACO, ants: defaultAnts(n), ...stripUndefined(options) };
  delete params.startIndex;

  // Trivial cases: with 1 or 2 stops there is only one possible open order.
  if (n <= 2) {
    const order = n === 1 ? [startIndex] : [startIndex, 1 - startIndex];
    return {
      order,
      totalTime: orderTime(timeMatrix, order),
      iterationsRun: 0,
      bestFoundAtIteration: 0,
      params,
    };
  }

  const random = mulberry32(params.seed);

  // Heuristic: 1 / travel time (closer = more attractive). Times of 0 (two places on the same
  // road node) are treated as 1 second to avoid dividing by zero.
  const heuristic = timeMatrix.map((row) => row.map((t) => 1 / Math.max(t, 1)));

  // Starting pheromone: as if every ant had walked the nearest-neighbour order,
  // ants * q / L_nn. This keeps the pheromone on the same scale as later deposits.
  const nnTime = Math.max(nearestNeighbourOrder(timeMatrix, startIndex).totalTime, 1);
  const tau0 = (params.ants * params.q) / nnTime;
  const pheromone = Array.from({ length: n }, () => new Array(n).fill(tau0));

  let bestOrder = null;
  let bestTime = Infinity;
  let bestFoundAtIteration = 0;
  let iterationsRun = 0;

  for (let iter = 1; iter <= params.iterations; iter++) {
    iterationsRun = iter;

    // 1. Every ant builds an order.
    const antOrders = [];
    for (let a = 0; a < params.ants; a++) {
      const order = buildAntOrder(timeMatrix, pheromone, heuristic, startIndex, params, random);
      const time = orderTime(timeMatrix, order);
      antOrders.push({ order, time });
      if (time < bestTime) {
        bestTime = time;
        bestOrder = order;
        bestFoundAtIteration = iter;
      }
    }

    // 2. Evaporation: every pheromone trail loses a share (1 - rho remains).
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) pheromone[i][j] *= 1 - params.evaporation;
    }

    // 3. Deposit (Ant System, plus an extra "elitist" deposit for the best order so far).
    //    Each ant adds q / L on every move i -> j of its order, so shorter orders add more.
    //    Moves are directed (i -> j), because driving times can differ by direction.
    //    The extra best-so-far deposit helps the colony converge without losing good orders.
    const depositors = params.elitist
      ? [...antOrders, { order: bestOrder, time: bestTime }]
      : antOrders;
    for (const { order, time } of depositors) {
      const amount = params.q / Math.max(time, 1);
      for (let k = 1; k < order.length; k++) pheromone[order[k - 1]][order[k]] += amount;
    }

    // 4. Trail limits (idea from the MAX-MIN Ant System): no trail may fall below tauMin, so
    //    every move keeps a small chance of being tried and the colony does not get stuck
    //    on the first good order it finds. tauMax is the level a move would reach if every
    //    ant used it in every round; tauMin is a small fraction of that.
    //    Switched off (trailLimits: false) in the textbook version.
    if (params.trailLimits) {
      const tauMax = ((params.ants + 1) * params.q) / (params.evaporation * Math.max(bestTime, 1));
      const tauMin = tauMax * params.trailMinRatio;
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          pheromone[i][j] = Math.min(tauMax, Math.max(tauMin, pheromone[i][j]));
        }
      }
    }

    // 5. Stop early when the best order has not improved for a while.
    if (iter - bestFoundAtIteration >= params.stagnationLimit) break;
  }

  return { order: bestOrder, totalTime: bestTime, iterationsRun, bestFoundAtIteration, params };
}

function stripUndefined(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

module.exports = { planVisitingOrderACO, mulberry32, DEFAULT_ACO, TEXTBOOK_ACO, defaultAnts };
