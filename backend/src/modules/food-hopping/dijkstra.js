// Route Planner: Dijkstra's shortest path algorithm on the travel graph.
//
// Dijkstra finds the quickest route from one start node to every other node. It keeps a
// "frontier" of nodes ordered by their best known travel time, always settles (finalises)
// the closest unsettled node next, and relaxes its edges ("is going through this node
// quicker than what I knew before?"). Because travel times are never negative, a settled
// node's time is final.
//
// buildTimeMatrix() runs Dijkstra once per stop to get the travel time between every pair of
// stops. The Ant Colony Optimisation step then uses this matrix to choose the visiting order.

const { AppError } = require("../../lib/response");
const {
  TRAVEL_SPEEDS,
  getTravelGraph,
  nearestNode,
  buildKnnFallbackGraph,
} = require("./travelGraph");

// A place further than this from any road node cannot be routed.
const MAX_SNAP_METERS = 1000;

// Binary min-heap: a priority queue that always gives back the item with the smallest key
// in O(log n) time. Stored as an array where the children of index i are 2i+1 and 2i+2.
class MinHeap {
  constructor() {
    this.items = []; // [{ key, value }]
  }

  get size() {
    return this.items.length;
  }

  push(key, value) {
    const items = this.items;
    items.push({ key, value });
    // Sift up: swap with the parent while smaller than it.
    let i = items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (items[parent].key <= items[i].key) break;
      [items[parent], items[i]] = [items[i], items[parent]];
      i = parent;
    }
  }

  pop() {
    const items = this.items;
    if (items.length === 0) return undefined;
    const top = items[0];
    const last = items.pop();
    if (items.length > 0) {
      items[0] = last;
      // Sift down: swap with the smaller child while bigger than it.
      let i = 0;
      for (;;) {
        const left = 2 * i + 1;
        const right = left + 1;
        let smallest = i;
        if (left < items.length && items[left].key < items[smallest].key) smallest = left;
        if (right < items.length && items[right].key < items[smallest].key) smallest = right;
        if (smallest === i) break;
        [items[smallest], items[i]] = [items[i], items[smallest]];
        i = smallest;
      }
    }
    return top;
  }
}

// Dijkstra from sourceNode. graph.adj[u] = [{ to, timeS, distM, ... }].
// Stops early once every target is settled. Returns, for each target, the travel time (s) and
// distance (m) of the quickest route (Infinity if unreachable), plus `prev`, which remembers
// for every settled node the edge used to reach it (to rebuild the route afterwards).
function shortestTravelTime(graph, sourceNode, targetNodes) {
  const n = graph.adj.length;
  const time = new Float64Array(n).fill(Infinity);
  const dist = new Float64Array(n).fill(Infinity);
  const settled = new Uint8Array(n);
  const prev = new Map(); // node -> { from, entry }

  const remaining = new Set(targetNodes);
  time[sourceNode] = 0;
  dist[sourceNode] = 0;
  const heap = new MinHeap();
  heap.push(0, sourceNode);

  while (heap.size > 0 && remaining.size > 0) {
    const { key, value: u } = heap.pop();
    // The heap may hold old, outdated copies of a node ("lazy deletion"); skip them.
    if (settled[u] || key > time[u]) continue;
    settled[u] = 1;
    remaining.delete(u);

    // Relax every edge leaving u.
    for (const entry of graph.adj[u]) {
      const v = entry.to;
      const newTime = time[u] + entry.timeS;
      if (!settled[v] && newTime < time[v]) {
        time[v] = newTime;
        dist[v] = dist[u] + entry.distM;
        prev.set(v, { from: u, entry });
        heap.push(newTime, v);
      }
    }
  }

  const times = new Map();
  const distances = new Map();
  for (const t of targetNodes) {
    times.set(t, time[t]);
    distances.set(t, dist[t]);
  }
  return { times, distances, prev };
}

const round6 = (x) => Math.round(x * 1e6) / 1e6;

// Follows `prev` back from target to source and returns the route as [[lat, lng], ...],
// including the in-between points of each road edge (for drawing on a map).
function rebuildPath(graph, prev, sourceNode, targetNode) {
  const steps = [];
  let node = targetNode;
  while (node !== sourceNode) {
    const step = prev.get(node);
    if (!step) return null; // target was not reached
    steps.push(step);
    node = step.from;
  }
  steps.reverse();

  const coords = [[round6(graph.lat[sourceNode]), round6(graph.lng[sourceNode])]];
  for (const { entry } of steps) {
    const shape = graph.shapes?.[entry.edgeId];
    if (shape) {
      const points = [];
      for (let k = 0; k < shape.length; k += 2) points.push([shape[k], shape[k + 1]]);
      // An edge travelled backwards has its shape points in reverse order.
      if (entry.reverse) points.reverse();
      coords.push(...points);
    }
    coords.push([round6(graph.lat[entry.to]), round6(graph.lng[entry.to])]);
  }
  return coords;
}

// Builds the n x n travel time matrix (seconds) and distance matrix (metres) between stops.
// stops: [{ lat, lng }]. Each stop is snapped to its nearest road node; the walk between the
// place and that node is added at both ends of every leg.
// Returns { timeS, distanceM, snaps, source, nodeCount, edgeCount, pathBetween(i, j) }.
function buildTimeMatrix(stops, mode, travelGraph = getTravelGraph()) {
  let snaps;
  if (travelGraph) {
    snaps = stops.map((s) => nearestNode(travelGraph, s.lat, s.lng, mode));
    snaps.forEach((snap, i) => {
      if (!snap || snap.distanceM > MAX_SNAP_METERS) {
        throw new AppError(422, "PLACE_NOT_ON_ROAD_GRAPH", "A place is too far from any road", {
          stopIndex: i,
        });
      }
    });
  } else {
    // Fallback (PLAN Q5 option b): graph built only from the chosen stops.
    console.warn("Route Planner: road graph missing, using the k-nearest-neighbour FALLBACK graph");
    travelGraph = buildKnnFallbackGraph(stops);
    snaps = stops.map((_, i) => ({ node: i, distanceM: 0 }));
  }

  const graph = travelGraph.modes[mode];
  const walkTime = (m) => m / TRAVEL_SPEEDS.walkingMps;
  const n = stops.length;
  const timeS = [];
  const distanceM = [];
  const prevBySource = [];

  for (let i = 0; i < n; i++) {
    const targets = snaps.map((s) => s.node);
    const result = shortestTravelTime(graph, snaps[i].node, targets);
    prevBySource.push(result.prev);
    timeS.push([]);
    distanceM.push([]);
    for (let j = 0; j < n; j++) {
      if (i === j) {
        timeS[i].push(0);
        distanceM[i].push(0);
        continue;
      }
      const t = result.times.get(snaps[j].node);
      const d = result.distances.get(snaps[j].node);
      const snapM = snaps[i].distanceM + snaps[j].distanceM;
      timeS[i].push(t + walkTime(snapM)); // stays Infinity if unreachable
      distanceM[i].push(d + snapM);
    }
  }

  // Route of one leg: place i -> its road node -> ... -> road node of j -> place j.
  function pathBetween(i, j) {
    const middle = rebuildPath(graph, prevBySource[i], snaps[i].node, snaps[j].node) ?? [];
    const all = [
      [round6(stops[i].lat), round6(stops[i].lng)],
      ...middle,
      [round6(stops[j].lat), round6(stops[j].lng)],
    ];
    // Drop repeated points (e.g. when a place sits exactly on its road node).
    return all.filter((p, k) => k === 0 || p[0] !== all[k - 1][0] || p[1] !== all[k - 1][1]);
  }

  return {
    timeS,
    distanceM,
    snaps,
    source: travelGraph.source,
    nodeCount: travelGraph.nodeCount,
    edgeCount: travelGraph.edgeCount,
    pathBetween,
  };
}

module.exports = { MinHeap, shortestTravelTime, rebuildPath, buildTimeMatrix, MAX_SNAP_METERS };
