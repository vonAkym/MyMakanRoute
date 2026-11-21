// Feasibility study (PLAN step 2.7): measures the real data and algorithms and writes the
// evidence for docs/FEASIBILITY.md.
// Usage: npm run feasibility   (needs DATABASE_URL in backend/.env and the road graph file)
// Output: a readable summary on the console + docs/feasibility-results.json.
//
// It reuses the real module code (hidden gem rule, search, Dijkstra, ACO, baselines, analytics)
// and only reads from the database. Ratings of SAMPLE places are invented, so every number
// based on ratings is about the method, not about real food places.

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const config = require("../src/config");
const db = require("../src/lib/db");
const { LABELS, labelHiddenGem } = require("../src/modules/food-discovery/hiddenGem");
const { searchFoodPlaces } = require("../src/modules/food-discovery/service");
const { getTravelGraph, GRAPH_FILE } = require("../src/modules/food-hopping/travelGraph");
const { buildTimeMatrix } = require("../src/modules/food-hopping/dijkstra");
const {
  planVisitingOrderACO,
  mulberry32,
  DEFAULT_ACO,
  TEXTBOOK_ACO,
} = require("../src/modules/food-hopping/antColony");
const {
  nearestNeighbourOrder,
  bruteForceOrder,
} = require("../src/modules/food-hopping/routeBaselines");
const { getAnalyticsOverview } = require("../src/modules/food-stalls-analytics/service");
const h = require("./feasibility-helpers");

const ROOT = path.join(__dirname, "..", "..");
const RESULTS_FILE = path.join(ROOT, "docs", "feasibility-results.json");
const OSM_SNAPSHOT = path.join(ROOT, "data", "osm-penang.json");

// Benchmark settings (fixed, so every run gives the same trips).
const KOMTAR = { lat: 5.4145, lng: 100.3292 };
const SEARCH_RADIUS_M = 1500;
const BENCHMARK_AREAS = ["George Town", "Pulau Tikus", "Jelutong", "Gurney"];
const BENCHMARK_SIZES = [4, 6, 8, 10];
// 10 trials per size by default; `npm run feasibility -- --trials=50` for a bigger sample.
const trialsArg = process.argv.find((a) => a.startsWith("--trials="));
const TRIALS_PER_SIZE = trialsArg ? Math.max(1, Number(trialsArg.split("=")[1]) || 10) : 10;
const BENCHMARK_SEED = 2026;
const BRUTE_FORCE_LIMIT_STOPS = 10;
const BRUTE_FORCE_SKIP_MS = 20000; // skip brute force for the rest of a size if slower
const ACO_VARIANTS = {
  improved: { ...DEFAULT_ACO }, // the default used by the API
  textbook: { ...DEFAULT_ACO, ...TEXTBOOK_ACO },
};

const minutes = (s) => h.round(s / 60, 1);

function timed(fn) {
  const t0 = process.hrtime.bigint();
  const result = fn();
  return { result, ms: Number(process.hrtime.bigint() - t0) / 1e6 };
}

function heading(title) {
  console.log(`\n=== ${title} ===`);
}

function gitCommit() {
  try {
    return execSync("git rev-parse --short HEAD", {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    return null;
  }
}

// ---------- 1. Data quality ----------

async function dataQuality() {
  heading("1. Data quality");
  const { rows } = await db.query(`
    select source,
           count(*)::int as total,
           count(*) filter (where nullif(trim(name), '') is not null)::int as named,
           count(*) filter (where nullif(trim(cuisine), '') is not null)::int as with_cuisine,
           count(*) filter (where opening_hours is not null)::int as with_hours,
           count(*) filter (where is_halal is not null)::int as with_halal,
           count(*) filter (where avg_rating is not null)::int as with_rating
      from places
     group by source
     order by total desc`);

  const bySource = rows.map((r) => ({
    source: r.source,
    total: r.total,
    namedPercent: h.percent(r.named, r.total),
    withCuisinePercent: h.percent(r.with_cuisine, r.total),
    withOpeningHoursPercent: h.percent(r.with_hours, r.total),
    withHalalTagPercent: h.percent(r.with_halal, r.total),
    withRatingPercent: h.percent(r.with_rating, r.total),
  }));
  console.log(
    h.formatTable(
      ["Source", "Places", "Named %", "Cuisine %", "Hours %", "Halal tag %", "Rating %"],
      bySource.map((s) => [
        s.source,
        s.total,
        s.namedPercent,
        s.withCuisinePercent,
        s.withOpeningHoursPercent,
        s.withHalalTagPercent,
        s.withRatingPercent,
      ]),
    ),
  );

  // The importer skips OSM elements without a name, so "named" is measured on the raw snapshot.
  let rawSnapshot = null;
  if (fs.existsSync(OSM_SNAPSHOT)) {
    const elements = JSON.parse(fs.readFileSync(OSM_SNAPSHOT, "utf8"));
    const named = elements.filter((e) => e.tags?.name).length;
    rawSnapshot = {
      elements: elements.length,
      named,
      namedPercent: h.percent(named, elements.length),
    };
    console.log(
      `Raw OSM snapshot: ${elements.length} elements, ${named} named (${rawSnapshot.namedPercent}%); ` +
        "only named ones are imported.",
    );
  }
  return { bySource, rawSnapshot };
}

async function loadSamplePlaces() {
  const { rows } = await db.query(`
    select id, name, area, cuisine, is_halal, avg_rating::float8 as avg_rating, review_count,
           st_y(location::geometry) as lat, st_x(location::geometry) as lng
      from places
     where is_sample is true
     order by name`);
  return rows.map((r) => ({ ...r, lat: Number(r.lat), lng: Number(r.lng) }));
}

// ---------- 2. Hidden gem rule ----------

function hiddenGems(samples) {
  heading("2. Hidden gem rule (SAMPLE places, invented ratings)");
  const t = config.hiddenGem;
  const labelCounts = h.countLabels(samples, t);
  const byArea = h.countBy(samples, (p) => p.area);
  console.log(`Sample places: ${samples.length}. By area: ${JSON.stringify(byArea)}`);
  console.log(
    `Thresholds: rating >= ${t.minRating}, reviews <= ${t.maxReviews}; Popular: reviews > ${t.popularMinReviews}`,
  );
  console.log(`Labels: ${JSON.stringify(labelCounts)}`);

  const gems = samples
    .filter((p) => labelHiddenGem(p, t) === LABELS.HIDDEN_GEM)
    .sort((a, b) => b.avg_rating - a.avg_rating || a.review_count - b.review_count)
    .map((p) => ({ name: p.name, area: p.area, rating: p.avg_rating, reviews: p.review_count }));
  console.log(
    h.formatTable(
      ["Hidden gem", "Area", "Rating", "Reviews"],
      gems.map((g) => [g.name, g.area, g.rating, g.reviews]),
    ),
  );

  const minRatings = [4.0, 4.3, 4.5];
  const maxReviews = [50, 100, 200];
  const sensitivity = h.hiddenGemSensitivity(samples, minRatings, maxReviews, t.popularMinReviews);
  console.log("\nSensitivity: number of hidden gems (rows: min rating, columns: max reviews)");
  console.log(
    h.formatTable(
      ["Min rating", ...maxReviews.map((m) => `<= ${m}`)],
      sensitivity.map((r) => [r.minRating.toFixed(1), ...maxReviews.map((m) => r.counts[m])]),
    ),
  );
  return { samplePlaces: samples.length, byArea, thresholds: t, labelCounts, gems, sensitivity };
}

// ---------- 3. Discovery search ----------

async function discoveryExample(halal) {
  // A high limit so every place in the radius is counted (the API caps limit at 100).
  const result = await searchFoodPlaces({
    ...KOMTAR,
    radius: SEARCH_RADIUS_M,
    halal,
    limit: 10000,
  });
  const labelCounts = h.countBy(result.places, (p) => p.label ?? h.NO_LABEL);
  const top5 = result.places.slice(0, 5).map((p) => ({
    name: p.name,
    label: p.label,
    rating: p.avgRating,
    reviews: p.reviewCount,
    distanceM: p.distanceM,
    isSample: p.isSample,
  }));
  console.log(
    `\nNear Komtar, ${SEARCH_RADIUS_M} m${halal ? ", halal only" : ""}: ${result.count} places`,
  );
  console.log(`Labels: ${JSON.stringify(labelCounts)}`);
  console.log(
    h.formatTable(
      ["#", "Name", "Label", "Rating", "Reviews", "Distance m"],
      top5.map((p, i) => [i + 1, p.name, p.label, p.rating, p.reviews, p.distanceM]),
    ),
  );
  return { halal: halal === true, count: result.count, labelCounts, top5 };
}

async function discovery() {
  heading("3. Discovery search examples");
  return {
    centre: { name: "Komtar", ...KOMTAR },
    radiusM: SEARCH_RADIUS_M,
    all: await discoveryExample(undefined),
    halalOnly: await discoveryExample(true),
  };
}

// ---------- 4. Road graph ----------

function roadGraph() {
  heading("4. Road graph");
  const { result: graph, ms } = timed(() => getTravelGraph());
  if (!graph) throw new Error("Road graph file missing: run `npm run build:road-graph` first.");
  const header = JSON.parse(fs.readFileSync(GRAPH_FILE, "utf8"));
  const mode = (m) => ({
    usableNodes: graph.modes[m].usableNodes,
    mainComponentNodes: graph.modes[m].mainComponentSize,
    mainComponentPercentOfUsable: h.percent(
      graph.modes[m].mainComponentSize,
      graph.modes[m].usableNodes,
    ),
    mainComponentPercentOfAll: h.percent(graph.modes[m].mainComponentSize, graph.nodeCount),
  });
  const stats = {
    source: graph.source,
    attribution: header.attribution,
    createdAt: header.createdAt,
    bbox: header.bbox,
    fileSizeMB: h.round(fs.statSync(GRAPH_FILE).size / 1024 / 1024, 2),
    nodes: graph.nodeCount,
    edges: graph.edgeCount,
    loadMs: h.round(ms, 0),
    walking: mode("walking"),
    driving: mode("driving"),
  };
  console.log(
    `Source ${stats.source} (${stats.createdAt}), ${stats.fileSizeMB} MB, ` +
      `${stats.nodes} nodes, ${stats.edges} edges, loaded in ${stats.loadMs} ms`,
  );
  console.log(
    h.formatTable(
      ["Mode", "Usable nodes", "Main part", "% of usable", "% of all"],
      ["walking", "driving"].map((m) => [
        m,
        stats[m].usableNodes,
        stats[m].mainComponentNodes,
        stats[m].mainComponentPercentOfUsable,
        stats[m].mainComponentPercentOfAll,
      ]),
    ),
  );
  return stats;
}

// ---------- 5. Route planner benchmark ----------

function runTrial(stops) {
  const matrix = timed(() => buildTimeMatrix(stops, "walking"));
  const m = matrix.result.timeS;
  if (m.some((row) => row.some((t) => !Number.isFinite(t)))) return null; // unreachable stop

  const trial = { matrixMs: matrix.ms, matrix: matrix.result, variants: {} };
  for (const [name, options] of Object.entries(ACO_VARIANTS)) {
    const run = timed(() => planVisitingOrderACO(m, { ...options, startIndex: 0 }));
    trial.variants[name] = {
      time: run.result.totalTime,
      ms: run.ms,
      order: run.result.order,
      iterationsRun: run.result.iterationsRun,
    };
  }
  const nn = timed(() => nearestNeighbourOrder(m, 0));
  trial.nn = { time: nn.result.totalTime, ms: nn.ms };
  return trial;
}

function benchmark(samples) {
  heading("5. Route planner benchmark (walking, SAMPLE places)");
  const pool = samples.filter((p) => BENCHMARK_AREAS.includes(p.area));
  console.log(`Pool: ${pool.length} sample places in ${BENCHMARK_AREAS.join(", ")}`);
  console.log(
    `ACO improved = ${JSON.stringify(ACO_VARIANTS.improved)}\n` +
      `ACO textbook = same but ${JSON.stringify(TEXTBOOK_ACO)}`,
  );

  const perSize = {};
  const notes = [];
  let example = null;
  for (const n of BENCHMARK_SIZES) {
    const random = mulberry32(BENCHMARK_SEED + n);
    const trials = [];
    let skipBruteForce = n > BRUTE_FORCE_LIMIT_STOPS;
    for (let k = 0; k < TRIALS_PER_SIZE; k++) {
      const places = h.selectTripPlaces(pool, n, random);
      const trial = runTrial(places);
      if (!trial) {
        notes.push(`n=${n} trial ${k + 1}: a stop was unreachable, trial skipped`);
        continue;
      }
      if (!skipBruteForce) {
        const bf = timed(() => bruteForceOrder(trial.matrix.timeS, 0, BRUTE_FORCE_LIMIT_STOPS));
        trial.optimum = { time: bf.result.totalTime, ms: bf.ms };
        if (bf.ms > BRUTE_FORCE_SKIP_MS) {
          skipBruteForce = true;
          notes.push(`n=${n}: brute force took ${Math.round(bf.ms)} ms, skipped for later trials`);
        }
      } else {
        trial.optimum = null;
      }
      // Worked example: the first 6-stop trip where the greedy nearest-neighbour order is not
      // the best one (more interesting to explain), or else the first 6-stop trip.
      const nnNotBest = trial.optimum && trial.nn.time > trial.optimum.time + 1e-6;
      if (n === 6 && (!example || (nnNotBest && !example.nnNotBest))) {
        example = { places, trial, nnNotBest };
      }
      trials.push(trial);
    }
    console.log(`  n=${n}: ${trials.length} trials done`);
    perSize[n] = h.summariseTrials(trials);
    perSize[n].avgIterationsRun = Object.fromEntries(
      Object.keys(ACO_VARIANTS).map((v) => [
        v,
        h.round(h.average(trials.map((t) => t.variants[v].iterationsRun)), 0),
      ]),
    );
  }

  console.log(
    h.formatTable(
      [
        "n",
        "Optimum min",
        "Dijkstra ms",
        "ACO-impr opt%",
        "gap%",
        "ms",
        "ACO-text opt%",
        "gap%",
        "ms",
        "NN opt%",
        "gap%",
        "ms",
        "Brute ms",
      ],
      BENCHMARK_SIZES.map((n) => {
        const s = perSize[n];
        return [
          n,
          s.avgOptimumMin,
          s.avgMatrixMs,
          s.variants.improved.optimalPercent,
          s.variants.improved.avgGapPercent,
          s.variants.improved.avgMs,
          s.variants.textbook.optimalPercent,
          s.variants.textbook.avgGapPercent,
          s.variants.textbook.avgMs,
          s.nearestNeighbour.optimalPercent,
          s.nearestNeighbour.avgGapPercent,
          s.nearestNeighbour.avgMs,
          s.bruteForce.avgMs,
        ];
      }),
    ),
  );
  notes.forEach((note) => console.log(`Note: ${note}`));

  const workedExample = example ? workedRoute(example) : null;
  return {
    travelMode: "walking",
    areas: BENCHMARK_AREAS,
    poolSize: pool.length,
    seed: BENCHMARK_SEED,
    trialsPerSize: TRIALS_PER_SIZE,
    acoVariants: { improved: ACO_VARIANTS.improved, textbook: ACO_VARIANTS.textbook },
    selection:
      "Per trial: a random anchor place (trip start) plus n-1 random places among the 2n nearest to it.",
    perSize,
    notes,
    workedExample,
  };
}

// The first n=6 trip where nearest-neighbour is not optimal (chosen to illustrate a
// difference), in the improved ACO order, with leg times and distances.
function workedRoute({ places, trial }) {
  const { timeS, distanceM } = trial.matrix;
  const order = trial.variants.improved.order;
  const legs = order.slice(1).map((j, k) => {
    const i = order[k];
    return {
      from: places[i].name,
      to: places[j].name,
      timeMin: minutes(timeS[i][j]),
      distanceM: Math.round(distanceM[i][j]),
    };
  });
  const result = {
    stops: order.map((i, k) => ({ step: k + 1, name: places[i].name, area: places[i].area })),
    legs,
    totalTimeMin: minutes(trial.variants.improved.time),
    totalDistanceM: legs.reduce((s, l) => s + l.distanceM, 0),
    optimumMin: trial.optimum ? minutes(trial.optimum.time) : null,
    nearestNeighbourMin: minutes(trial.nn.time),
    textbookAcoMin: minutes(trial.variants.textbook.time),
  };
  console.log("\nWorked example (n = 6, improved ACO order):");
  console.log(
    h.formatTable(
      ["Leg", "From", "To", "Minutes", "Metres"],
      legs.map((l, k) => [k + 1, l.from, l.to, l.timeMin, l.distanceM]),
    ),
  );
  console.log(
    `Total ${result.totalTimeMin} min, ${result.totalDistanceM} m ` +
      `(optimum ${result.optimumMin} min, nearest neighbour ${result.nearestNeighbourMin} min, ` +
      `textbook ACO ${result.textbookAcoMin} min)`,
  );
  return result;
}

// ---------- 6. Analytics ----------

async function analytics() {
  heading("6. Analytics overview");
  const overview = await getAnalyticsOverview();
  const topAreas = h.topGroupsByRating(overview.byArea, 3, 3);
  console.log(`Totals: ${JSON.stringify(overview.totals)}`);
  console.log(`Labels: ${overview.labels.map((l) => `${l.label} ${l.count}`).join(", ")}`);
  console.log(
    h.formatTable(
      ["Top area (>= 3 places)", "Places", "Avg rating"],
      topAreas.map((a) => [a.name, a.places, a.averageRating]),
    ),
  );
  overview.findings.forEach((f) => console.log(`- ${f}`));
  return {
    totals: overview.totals,
    labels: overview.labels,
    topAreas,
    findings: overview.findings,
    note: overview.note ?? null,
  };
}

async function main() {
  const started = Date.now();
  console.log("MyMakanRoute feasibility study");
  const results = {
    generatedAt: new Date().toISOString(),
    gitCommit: gitCommit(),
    note: "Ratings and review counts of SAMPLE places are invented; they test the method only.",
  };
  try {
    results.dataQuality = await dataQuality();
    const samples = await loadSamplePlaces();
    results.hiddenGems = hiddenGems(samples);
    results.discovery = await discovery();
    results.roadGraph = roadGraph();
    results.routeBenchmark = benchmark(samples);
    results.analytics = await analytics();
  } finally {
    await db.closePool();
  }
  results.runtimeSeconds = h.round((Date.now() - started) / 1000, 1);
  fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2) + "\n");
  console.log(
    `\nDone in ${results.runtimeSeconds} s. Results saved to ${path.relative(process.cwd(), RESULTS_FILE)}`,
  );
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
