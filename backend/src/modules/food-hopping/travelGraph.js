// Route Planner: the travel graph (roads as nodes + edges, weighted by travel time).
//
// The road graph file (data/road-graph-penang.json) is made by scripts/build-road-graph.js.
// It is loaded once, the first time a route is planned, and turned into one adjacency list
// per travel mode ("which nodes can I reach directly from this node, and how long does it take").
//
// If the file does not exist (the OpenStreetMap download failed), the route planner uses a
// simple fallback: a k-nearest-neighbour graph between the chosen places, with straight-line
// distance x 1.3 as an estimate of the real road distance.

const fs = require("fs");
const path = require("path");

const GRAPH_FILE = path.join(__dirname, "..", "..", "..", "..", "data", "road-graph-penang.json");

// Bit flags stored on every edge in the graph file.
const EDGE_FLAGS = { ONEWAY: 1, WALK: 2, DRIVE: 4 };

// All travel speeds in one place. These are ASSUMPTIONS for urban George Town traffic,
// not measured values. Walking 1.4 m/s is about 5 km/h.
const TRAVEL_SPEEDS = Object.freeze({
  walkingMps: 1.4,
  drivingKmh: Object.freeze({
    motorway: 70,
    motorway_link: 40,
    trunk: 50,
    trunk_link: 30,
    primary: 40,
    primary_link: 30,
    secondary: 35,
    secondary_link: 25,
    tertiary: 30,
    tertiary_link: 25,
    residential: 20,
    unclassified: 20,
    service: 20,
    living_street: 10,
  }),
  drivingDefaultKmh: 20, // any other road type (e.g. track)
});

// Fallback graph settings: each place is linked to its 4 nearest places, and the road distance
// is estimated as straight-line distance x 1.3 (roads are rarely straight).
const FALLBACK_K = 4;
const FALLBACK_DETOUR_FACTOR = 1.3;

// Grid index cell size in degrees (about 220 m in Penang), used to find the nearest node fast.
const GRID_CELL_DEG = 0.002;
const GRID_MAX_RINGS = 25; // search at most ~5.5 km around a place

const EARTH_RADIUS_M = 6371000;

// Great-circle ("as the crow flies") distance between two points, in metres.
function haversineMeters(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

function drivingSpeedMps(highway) {
  const kmh = TRAVEL_SPEEDS.drivingKmh[highway] ?? TRAVEL_SPEEDS.drivingDefaultKmh;
  return kmh / 3.6;
}

// Builds the adjacency list for one travel mode. Each entry is
// { to, timeS, distM, edgeId, reverse } where reverse = true means the edge is used
// backwards (needed to draw its shape in the right order).
function buildAdjacency(raw, mode) {
  const adj = Array.from({ length: raw.nodes.length }, () => []);
  const needFlag = mode === "walking" ? EDGE_FLAGS.WALK : EDGE_FLAGS.DRIVE;

  raw.edges.forEach(([from, to, distM, hwIndex, flags], edgeId) => {
    if (!(flags & needFlag)) return;
    const speed =
      mode === "walking" ? TRAVEL_SPEEDS.walkingMps : drivingSpeedMps(raw.highwayTypes[hwIndex]);
    const timeS = distM / speed;
    adj[from].push({ to, timeS, distM, edgeId, reverse: false });
    // People on foot may walk both ways along a one-way street; cars may not.
    const bothWays = mode === "walking" || !(flags & EDGE_FLAGS.ONEWAY);
    if (bothWays) adj[to].push({ to: from, timeS, distM, edgeId, reverse: true });
  });
  return adj;
}

// Marks every node reachable from `start` (breadth-first search) in `seen`
// and returns the list of nodes it found.
function markReachable(adj, start, seen) {
  const queue = [start];
  seen[start] = 1;
  for (let head = 0; head < queue.length; head++) {
    for (const { to } of adj[queue[head]]) {
      if (!seen[to]) {
        seen[to] = 1;
        queue.push(to);
      }
    }
  }
  return queue;
}

// Finds the main connected part of the network for one mode, so a place is never snapped to
// an isolated road piece (e.g. a car park road) from which nothing else can be reached.
// Steps: (1) treat roads as two-way and find the largest group of linked nodes; (2) for
// driving, one-way streets matter, so keep only nodes that can both reach and be reached from
// a well-connected node of that group (forward search AND backward search).
function findMainComponent(adj) {
  const n = adj.length;
  const undirected = Array.from({ length: n }, () => []);
  const reverse = Array.from({ length: n }, () => []);
  let usableNodes = 0;
  adj.forEach((list, u) => {
    for (const { to } of list) {
      undirected[u].push({ to });
      undirected[to].push({ to: u });
      reverse[to].push({ to: u });
    }
  });

  // (1) Largest weakly connected group, remembering its best-connected node as the "root".
  const seen = new Uint8Array(n);
  let root = -1;
  let bestSize = 0;
  for (let u = 0; u < n; u++) {
    if (seen[u] || undirected[u].length === 0) continue;
    const group = markReachable(undirected, u, seen);
    if (group.length > bestSize) {
      bestSize = group.length;
      // Pick the node with the most connections in this group as the root.
      root = group.reduce((a, b) => (adj[b].length > adj[a].length ? b : a));
    }
  }
  for (let u = 0; u < n; u++) if (undirected[u].length) usableNodes++;

  const inMain = new Uint8Array(n);
  if (root < 0) return { inMain, size: 0, usableNodes };

  // (2) Forward and backward search from the root; nodes found by both are mutually reachable.
  const forward = new Uint8Array(n);
  const backward = new Uint8Array(n);
  markReachable(adj, root, forward);
  markReachable(reverse, root, backward);
  let size = 0;
  for (let u = 0; u < n; u++) {
    if (forward[u] && backward[u]) {
      inMain[u] = 1;
      size++;
    }
  }
  return { inMain, size, usableNodes };
}

const cellKey = (lat, lng) =>
  `${Math.floor(lat / GRID_CELL_DEG)}:${Math.floor(lng / GRID_CELL_DEG)}`;

// Grid ("bucket") index: nodes are dropped into ~220 m squares so the nearest-node search
// only looks at a few squares around a place instead of every node.
function buildGrid(lat, lng, inMain) {
  const grid = new Map();
  for (let u = 0; u < inMain.length; u++) {
    if (!inMain[u]) continue;
    const key = cellKey(lat[u], lng[u]);
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(u);
  }
  return grid;
}

// Turns the raw graph (file format) into a ready-to-use travel graph with one entry per mode.
function buildTravelGraph(raw) {
  const n = raw.nodes.length;
  const lat = new Float64Array(n);
  const lng = new Float64Array(n);
  raw.nodes.forEach(([la, ln], i) => {
    lat[i] = la;
    lng[i] = ln;
  });
  // Intermediate points of each edge (flat [lat, lng, lat, lng, ...]) or null.
  const shapes = raw.edges.map((e) => e[5] || null);

  const modes = {};
  for (const mode of ["walking", "driving"]) {
    const adj = buildAdjacency(raw, mode);
    const { inMain, size, usableNodes } = findMainComponent(adj);
    modes[mode] = {
      mode,
      lat,
      lng,
      shapes,
      adj,
      inMain,
      usableNodes,
      mainComponentSize: size,
      grid: buildGrid(lat, lng, inMain),
    };
  }

  return { source: raw.source, nodeCount: n, edgeCount: raw.edges.length, lat, lng, modes };
}

// Snaps a place to the closest graph node of the main component for this mode.
// Returns { node, distanceM } or null when no node is within ~5.5 km.
function nearestNode(travelGraph, lat, lng, mode) {
  const g = travelGraph.modes[mode];
  const row = Math.floor(lat / GRID_CELL_DEG);
  const col = Math.floor(lng / GRID_CELL_DEG);
  // Smallest side of a cell in metres (east-west cells shrink slightly away from the equator).
  const cellMeters = GRID_CELL_DEG * 111320 * Math.cos((lat * Math.PI) / 180);

  let best = null;
  // Search square "rings" of cells around the place, growing outwards.
  for (let r = 0; r <= GRID_MAX_RINGS; r++) {
    for (let dr = -r; dr <= r; dr++) {
      for (let dc = -r; dc <= r; dc++) {
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== r) continue; // only the ring's edge cells
        const cell = g.grid.get(`${row + dr}:${col + dc}`);
        if (!cell) continue;
        for (const u of cell) {
          const d = haversineMeters(lat, lng, g.lat[u], g.lng[u]);
          if (!best || d < best.distanceM) best = { node: u, distanceM: d };
        }
      }
    }
    // Any node in a further ring is at least r cells away, so it cannot be closer.
    if (best && best.distanceM <= r * cellMeters) break;
  }
  return best;
}

// Fallback graph (PLAN Q5 option b): links each place to its k nearest places.
// points: [{ lat, lng }]. Graph node i is points[i], so snapping is exact (0 m).
function buildKnnFallbackGraph(points, k = FALLBACK_K) {
  const edges = [];
  const linked = new Set();
  points.forEach((p, i) => {
    const nearest = points
      .map((q, j) => ({ j, d: haversineMeters(p.lat, p.lng, q.lat, q.lng) }))
      .filter(({ j }) => j !== i)
      .sort((a, b) => a.d - b.d)
      .slice(0, k);
    for (const { j, d } of nearest) {
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (linked.has(key)) continue; // two-way edge already added from the other side
      linked.add(key);
      edges.push([i, j, d * FALLBACK_DETOUR_FACTOR, 0, EDGE_FLAGS.WALK | EDGE_FLAGS.DRIVE]);
    }
  });
  return buildTravelGraph({
    source: "knn-fallback",
    highwayTypes: ["estimated"],
    nodes: points.map((p) => [p.lat, p.lng]),
    edges,
  });
}

// Lazy, cached road graph. undefined = not loaded yet, null = file missing.
let cachedGraph;

function getTravelGraph() {
  if (cachedGraph === undefined) {
    if (fs.existsSync(GRAPH_FILE)) {
      const raw = JSON.parse(fs.readFileSync(GRAPH_FILE, "utf8"));
      cachedGraph = buildTravelGraph(raw);
    } else {
      console.warn(
        "Road graph file missing (run `npm run build:road-graph`). " +
          "Route Planner is using the k-nearest-neighbour FALLBACK graph.",
      );
      cachedGraph = null;
    }
  }
  return cachedGraph;
}

// Tests inject a small hand-made graph here instead of loading the real file.
function setTravelGraph(graph) {
  cachedGraph = graph;
}

function resetTravelGraph() {
  cachedGraph = undefined;
}

module.exports = {
  GRAPH_FILE,
  EDGE_FLAGS,
  TRAVEL_SPEEDS,
  FALLBACK_K,
  FALLBACK_DETOUR_FACTOR,
  haversineMeters,
  buildTravelGraph,
  nearestNode,
  buildKnnFallbackGraph,
  getTravelGraph,
  setTravelGraph,
  resetTravelGraph,
};
