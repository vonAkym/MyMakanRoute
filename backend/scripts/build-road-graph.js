// Builds the road graph used by the Route Planner (Food Hopping) from OpenStreetMap.
// Usage: npm run build:road-graph
// Output: data/road-graph-penang.json (compact JSON).
// Data © OpenStreetMap contributors, ODbL.
//
// Graph words used below:
//   node = a point where roads meet (an intersection) or a road ends
//   edge = a piece of road between two nodes, with its length in metres
//
// If Overpass cannot be reached after all retries, no file is written and the route
// planner uses its k-nearest-neighbour fallback graph instead (see travelGraph.js).

const fs = require("fs");
const path = require("path");
const {
  haversineMeters,
  EDGE_FLAGS,
  buildTravelGraph,
} = require("../src/modules/food-hopping/travelGraph");

// south, west, north, east: same area as import-osm.js (Gelugor/USM up to George Town)
const BBOX = [5.33, 100.27, 5.46, 100.345];
const SERVERS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];
const OUTPUT = path.join(__dirname, "..", "..", "data", "road-graph-penang.json");

// highway=* values that are not real travel routes (planned roads, platforms, lifts...).
const EXCLUDED_HIGHWAYS = [
  "proposed",
  "construction",
  "abandoned",
  "platform",
  "raceway",
  "bus_guideway",
  "elevator",
  "escape",
  "razed",
  "corridor",
  "bus_stop",
  "rest_area",
  "services",
];

const query = `[out:json][timeout:180];
way["highway"]["highway"!~"^(${EXCLUDED_HIGHWAYS.join("|")})$"](${BBOX.join(",")});
out body; >; out skel qt;`;

// Same retry pattern as import-osm.js: try every server, then wait longer and try again.
async function fetchOverpass() {
  for (let attempt = 0; attempt < 4; attempt++) {
    for (const url of SERVERS) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "MyMakanRoute-FYP/0.1",
          },
          body: new URLSearchParams({ data: query }),
          // Give up on a server that does not answer within 4 minutes and try the next one.
          signal: AbortSignal.timeout(240000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        console.log(`Fetched ${json.elements.length} elements from ${url}`);
        return json.elements;
      } catch (err) {
        console.warn(`Overpass failed (${url}): ${err.message}`);
      }
    }
    const wait = 10000 * 2 ** attempt;
    console.log(`All servers busy, retrying in ${wait / 1000}s...`);
    await new Promise((r) => setTimeout(r, wait));
  }
  throw new Error("Overpass API unavailable, try again later");
}

// Road types only for people on foot (no cars).
const FOOT_ONLY = ["footway", "path", "pedestrian", "steps", "bridleway"];
// Fast roads where walking is not allowed unless tagged foot=yes.
const NO_WALKING = ["motorway", "motorway_link", "trunk", "trunk_link"];

// Decides who may use a way and in which direction.
// Returns { walkable, drivable, oneway } where oneway is 0 (both ways), 1 (forward) or -1 (backward).
function classifyWay(tags) {
  const hw = tags.highway;
  const closed = tags.access === "no" || tags.access === "private";
  const footYes = ["yes", "designated", "permissive"].includes(tags.foot);

  const walkable = tags.foot === "no" ? false : footYes || (!closed && !NO_WALKING.includes(hw));
  const drivable =
    !closed &&
    !FOOT_ONLY.includes(hw) &&
    hw !== "cycleway" &&
    tags.motor_vehicle !== "no" &&
    tags.motorcar !== "no";

  let oneway = 0;
  if (["yes", "true", "1"].includes(tags.oneway)) oneway = 1;
  else if (tags.oneway === "-1" || tags.oneway === "reverse") oneway = -1;
  else if (tags.junction === "roundabout" || hw === "motorway") oneway = 1;

  return { walkable, drivable, oneway };
}

const round6 = (x) => Math.round(x * 1e6) / 1e6;

// Turns Overpass elements into a compact graph.
// Simplification: only way end points and nodes shared by 2+ ways (intersections) become
// graph nodes. The points in between are merged into one edge whose length is the sum of
// the small straight pieces; their coordinates are kept as the edge "shape" for drawing.
function buildRoadGraph(elements) {
  const coords = new Map(); // OSM node id -> [lat, lng]
  const ways = [];
  for (const el of elements) {
    if (el.type === "node") coords.set(el.id, [el.lat, el.lon]);
    else if (el.type === "way" && el.tags && el.nodes) ways.push(el);
  }

  // 1. Classify ways and drop the ones nobody can travel on.
  const usable = [];
  for (const way of ways) {
    const cls = classifyWay(way.tags);
    if (!cls.walkable && !cls.drivable) continue;
    let ids = way.nodes.filter((id) => coords.has(id));
    if (ids.length < 2) continue;
    // A backward one-way is stored as a forward one-way with the node order reversed.
    if (cls.oneway === -1) ids = ids.slice().reverse();
    usable.push({ ids, tags: way.tags, cls });
  }

  // 2. Count how often each OSM node is used. End points always count as graph nodes.
  const useCount = new Map();
  for (const { ids } of usable) {
    for (const id of ids) useCount.set(id, (useCount.get(id) || 0) + 1);
    useCount.set(ids[0], useCount.get(ids[0]) + 1);
    useCount.set(ids[ids.length - 1], useCount.get(ids[ids.length - 1]) + 1);
  }
  const isGraphNode = (id) => useCount.get(id) >= 2;

  // 3. Give each graph node a small index (0, 1, 2...) instead of its long OSM id.
  const nodeIndex = new Map();
  const nodes = [];
  const indexOf = (id) => {
    if (!nodeIndex.has(id)) {
      nodeIndex.set(id, nodes.length);
      const [lat, lng] = coords.get(id);
      nodes.push([round6(lat), round6(lng)]);
    }
    return nodeIndex.get(id);
  };

  // 4. Split each way at graph nodes into edges: [from, to, lengthM, highwayType, flags, shape?]
  const highwayTypes = [];
  const edges = [];
  for (const { ids, tags, cls } of usable) {
    if (!highwayTypes.includes(tags.highway)) highwayTypes.push(tags.highway);
    const hwIndex = highwayTypes.indexOf(tags.highway);
    const flags =
      (cls.oneway ? EDGE_FLAGS.ONEWAY : 0) |
      (cls.walkable ? EDGE_FLAGS.WALK : 0) |
      (cls.drivable ? EDGE_FLAGS.DRIVE : 0);

    let start = ids[0];
    let length = 0;
    let shape = [];
    for (let i = 1; i < ids.length; i++) {
      const [lat1, lng1] = coords.get(ids[i - 1]);
      const [lat2, lng2] = coords.get(ids[i]);
      length += haversineMeters(lat1, lng1, lat2, lng2);
      if (isGraphNode(ids[i])) {
        // Skip loops that come back to the same node: they never shorten a route.
        if (ids[i] !== start) {
          const edge = [indexOf(start), indexOf(ids[i]), Math.round(length * 10) / 10, hwIndex];
          edge.push(flags);
          if (shape.length) edge.push(shape);
          edges.push(edge);
        }
        start = ids[i];
        length = 0;
        shape = [];
      } else {
        shape.push(round6(lat2), round6(lng2));
      }
    }
  }

  return {
    format: 1,
    source: "osm-roads",
    attribution: "Data © OpenStreetMap contributors, ODbL",
    bbox: BBOX,
    createdAt: new Date().toISOString(),
    highwayTypes,
    nodes,
    edges,
  };
}

async function main() {
  let elements;
  try {
    elements = await fetchOverpass();
  } catch (err) {
    console.error(`${err.message}.`);
    console.error(
      "FALLBACK: no road graph was written. The route planner will use the " +
        "k-nearest-neighbour fallback graph until this script succeeds.",
    );
    process.exit(1);
  }

  const graph = buildRoadGraph(elements);
  const text = JSON.stringify(graph);
  fs.writeFileSync(OUTPUT, text);

  console.log(`Nodes: ${graph.nodes.length}, edges: ${graph.edges.length}`);
  console.log(
    `Saved ${path.relative(process.cwd(), OUTPUT)} (${(text.length / 1e6).toFixed(1)} MB)`,
  );

  // Report how much of the network is connected for each travel mode.
  const travel = buildTravelGraph(graph);
  for (const mode of ["walking", "driving"]) {
    const m = travel.modes[mode];
    console.log(
      `${mode}: ${m.usableNodes} nodes have ${mode} roads, ` +
        `${m.mainComponentSize} are in the main connected part (used for routing)`,
    );
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}

module.exports = { classifyWay, buildRoadGraph, EXCLUDED_HIGHWAYS };
