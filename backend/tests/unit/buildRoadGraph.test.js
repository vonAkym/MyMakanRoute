// Route Planner: turning OpenStreetMap ways into the compact road graph.

const { classifyWay, buildRoadGraph } = require("../../scripts/build-road-graph");
const { EDGE_FLAGS } = require("../../src/modules/food-hopping/travelGraph");

describe("classifyWay", () => {
  test("normal street: walk and drive, two-way", () => {
    expect(classifyWay({ highway: "residential" })).toEqual({
      walkable: true,
      drivable: true,
      oneway: 0,
    });
  });

  test("footway, path, steps, pedestrian: walking only", () => {
    for (const hw of ["footway", "path", "steps", "pedestrian"]) {
      expect(classifyWay({ highway: hw })).toMatchObject({ walkable: true, drivable: false });
    }
  });

  test("motorway/trunk: no walking unless foot=yes", () => {
    expect(classifyWay({ highway: "trunk" }).walkable).toBe(false);
    expect(classifyWay({ highway: "trunk", foot: "yes" }).walkable).toBe(true);
    expect(classifyWay({ highway: "motorway" }).oneway).toBe(1);
  });

  test("one-way tags and roundabouts", () => {
    expect(classifyWay({ highway: "primary", oneway: "yes" }).oneway).toBe(1);
    expect(classifyWay({ highway: "primary", oneway: "-1" }).oneway).toBe(-1);
    expect(classifyWay({ highway: "primary", junction: "roundabout" }).oneway).toBe(1);
  });

  test("private access: nobody", () => {
    expect(classifyWay({ highway: "service", access: "private" })).toMatchObject({
      walkable: false,
      drivable: false,
    });
  });
});

describe("buildRoadGraph", () => {
  // Way 10: 1 - 2 - 3 (node 2 is only on this way). Way 11: 4 - 3, oneway=-1. Node 3 is shared.
  const elements = [
    { type: "node", id: 1, lat: 5.4, lon: 100.3 },
    { type: "node", id: 2, lat: 5.401, lon: 100.3 },
    { type: "node", id: 3, lat: 5.402, lon: 100.3 },
    { type: "node", id: 4, lat: 5.402, lon: 100.301 },
    { type: "way", id: 10, nodes: [1, 2, 3], tags: { highway: "residential" } },
    { type: "way", id: 11, nodes: [4, 3], tags: { highway: "tertiary", oneway: "-1" } },
    { type: "way", id: 12, nodes: [1, 4], tags: { highway: "service", access: "no" } },
  ];

  test("keeps only end points and intersections, merging the points in between", () => {
    const g = buildRoadGraph(elements);
    expect(g.nodes).toHaveLength(3); // nodes 1, 3, 4 (node 2 is merged into the edge)
    const [first] = g.edges;
    expect(first[2]).toBeCloseTo(222.4, 0); // 1 -> 2 -> 3, lengths summed
    expect(first[5]).toEqual([5.401, 100.3]); // the shape keeps node 2 for drawing
  });

  test("stores a backward one-way as forward with the node order reversed", () => {
    const g = buildRoadGraph(elements);
    const oneway = g.edges.find((e) => e[4] & EDGE_FLAGS.ONEWAY);
    expect(g.nodes[oneway[0]]).toEqual([5.402, 100.3]); // from node 3
    expect(g.nodes[oneway[1]]).toEqual([5.402, 100.301]); // to node 4
  });

  test("drops ways nobody can use", () => {
    const g = buildRoadGraph(elements);
    expect(g.highwayTypes).not.toContain("service");
    expect(g.edges).toHaveLength(2);
  });
});
