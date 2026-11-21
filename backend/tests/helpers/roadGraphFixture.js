// A tiny hand-made road graph (same format as data/road-graph-penang.json) for tests.
//
//   0 ---- 1 ---- 2        row at lat 5.4150, nodes ~111 m apart (0.001 deg of longitude)
//   |      |      |
//   3 ---- 4 ---- 5        row at lat 5.4140
//
//   6 ---- 7               a separate road piece far away (not connected to the rest)
//
// Edge 1->2 is one-way (cars may only go 1 -> 2). Edge 3-4 is a footway (walking only).

const { EDGE_FLAGS } = require("../../src/modules/food-hopping/travelGraph");

const BOTH = EDGE_FLAGS.WALK | EDGE_FLAGS.DRIVE;

const fixtureRawGraph = {
  format: 1,
  source: "osm-roads",
  highwayTypes: ["residential", "footway"],
  nodes: [
    [5.415, 100.33],
    [5.415, 100.331],
    [5.415, 100.332],
    [5.414, 100.33],
    [5.414, 100.331],
    [5.414, 100.332],
    [5.45, 100.3],
    [5.45, 100.301],
  ],
  edges: [
    [0, 1, 110.7, 0, BOTH],
    [1, 2, 110.7, 0, BOTH | EDGE_FLAGS.ONEWAY, [5.415, 100.3315]],
    [0, 3, 111.2, 0, BOTH],
    [1, 4, 111.2, 0, BOTH],
    [2, 5, 111.2, 0, BOTH],
    [3, 4, 110.7, 1, EDGE_FLAGS.WALK],
    [4, 5, 110.7, 0, BOTH],
    [6, 7, 110.7, 0, BOTH],
  ],
};

module.exports = { fixtureRawGraph };
