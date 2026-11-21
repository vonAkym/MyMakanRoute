// DEMO COPY of backend/src/modules/food-stalls-analytics/clustering.js (ES module version).
// Used only by the GitHub Pages demo, which runs without the backend. Keep both in step.

// Food Places Analysis: DBSCAN clustering of food places by location.
//
// DBSCAN ("density-based spatial clustering of applications with noise", Ester et al., 1996)
// is unsupervised machine learning: it finds groups in data without being told the answers.
// Here it finds FOOD CLUSTERS: streets or corners where many food places stand close together.
//   - A place is a "core" place when at least minPoints places (itself included) are within
//     epsM metres of it.
//   - A cluster grows from a core place to every place within epsM of a core place.
//   - Places that belong to no cluster are "noise" (stand-alone stalls).
// It needs no number of clusters in advance (unlike k-means) and handles odd shapes such as a
// long food street.
// Each cluster is then described (size, centre, main area, ratings), and the hidden gem rule
// is applied to the whole cluster: an area whose places are rated highly but have few
// reviews is a HIDDEN GEM AREA, a whole street that visitors overlook.
// Pure functions (no database), so they are easy to unit test.

import { LABELS } from "./discovery.js";

// Tuned on the 1,117 located OpenStreetMap + SAMPLE places of the prototype area: 60 m and 6
// places give street-sized clusters (about 33), while 150 m joins most of George Town into
// one large cluster.
const DEFAULT_CLUSTERING = Object.freeze({ epsM: 60, minPoints: 6 });
const NOISE = -1;
const EARTH_RADIUS_M = 6371000;

function haversineMeters(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const a =
    Math.sin(toRad(lat2 - lat1) / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(toRad(lng2 - lng1) / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

// points: [{ lat, lng }]. Returns one cluster number per point (0, 1, ...) or -1 for noise.
function dbscan(
  points,
  { epsM = DEFAULT_CLUSTERING.epsM, minPoints = DEFAULT_CLUSTERING.minPoints } = {},
) {
  const n = points.length;
  const labels = new Array(n).fill(undefined);
  // Neighbours of every point within epsM (the point itself included). n is at most a few
  // thousand places, so comparing every pair is fast enough.
  const neighbours = points.map((p) =>
    points.reduce((list, q, j) => {
      if (haversineMeters(p.lat, p.lng, q.lat, q.lng) <= epsM) list.push(j);
      return list;
    }, []),
  );

  let cluster = 0;
  for (let i = 0; i < n; i++) {
    if (labels[i] !== undefined) continue;
    if (neighbours[i].length < minPoints) {
      labels[i] = NOISE; // may still join a cluster later as a border place
      continue;
    }
    // i is a core place: start a new cluster and grow it.
    labels[i] = cluster;
    const queue = [...neighbours[i]];
    while (queue.length > 0) {
      const j = queue.shift();
      if (labels[j] === NOISE) labels[j] = cluster; // border place
      if (labels[j] !== undefined) continue;
      labels[j] = cluster;
      if (neighbours[j].length >= minPoints) queue.push(...neighbours[j]); // j is core too
    }
    cluster += 1;
  }
  return labels;
}

const round2 = (x) => Math.round(x * 100) / 100;
const round6 = (x) => Math.round(x * 1e6) / 1e6;

function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

// Most common non-empty value, or the fallback.
function mostCommon(values, fallback) {
  const counts = new Map();
  for (const v of values) if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best = fallback;
  let bestCount = 0;
  for (const [v, c] of counts) {
    if (c > bestCount) {
      best = v;
      bestCount = c;
    }
  }
  return best;
}

// places: [{ id, name, area, lat, lng, avgRating, reviewCount, label }] (rated or not).
// thresholds: hidden gem thresholds (minRating, maxReviews).
// Returns { clusters: [...] biggest first, noisePlaces, settings }.
function findFoodClusters(places, thresholds, settings = DEFAULT_CLUSTERING) {
  const located = places.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  const labels = dbscan(located, settings);
  const groups = new Map();
  located.forEach((p, i) => {
    if (labels[i] === NOISE) return;
    if (!groups.has(labels[i])) groups.set(labels[i], []);
    groups.get(labels[i]).push(p);
  });

  const clusters = [...groups.values()].map((members) => {
    const rated = members.filter((p) => p.avgRating != null && p.reviewCount > 0);
    const averageRating =
      rated.length > 0 ? round2(rated.reduce((s, p) => s + p.avgRating, 0) / rated.length) : null;
    // Median, not mean: one famous stall with thousands of reviews should not hide that the
    // other places in the cluster are little known.
    const medianReviews = median(rated.map((p) => p.reviewCount));
    const hiddenGems = members.filter((p) => p.label === LABELS.HIDDEN_GEM).length;
    // The hidden gem rule on a whole cluster (at least 2 rated places).
    const isHiddenGemArea =
      rated.length >= 2 &&
      averageRating >= thresholds.minRating &&
      medianReviews <= thresholds.maxReviews;
    const best = [...rated].sort((a, b) => b.avgRating - a.avgRating).slice(0, 3);
    return {
      places: members.length,
      centre: {
        lat: round6(members.reduce((s, p) => s + p.lat, 0) / members.length),
        lng: round6(members.reduce((s, p) => s + p.lng, 0) / members.length),
      },
      area: mostCommon(
        members.map((p) => p.area),
        "Unknown area",
      ),
      ratedPlaces: rated.length,
      averageRating,
      medianReviews,
      hiddenGems,
      isHiddenGemArea,
      topPlaces: best.map((p) => p.name),
    };
  });

  clusters.sort((a, b) => b.places - a.places || (b.averageRating ?? 0) - (a.averageRating ?? 0));
  return {
    clusters: clusters.map((c, i) => ({ id: i + 1, ...c })),
    noisePlaces: labels.filter((l) => l === NOISE).length,
    settings: { epsM: settings.epsM, minPoints: settings.minPoints },
  };
}

const oneDecimal = (x) => (Math.round((Number(x) + Number.EPSILON) * 10) / 10).toFixed(1);

// Short findings for the Analytics page (added to the other findings).
function describeFoodClusters({ clusters, noisePlaces, settings }) {
  if (clusters.length === 0) return [];
  const findings = [];
  const biggest = clusters[0];
  findings.push(
    `Clustering (DBSCAN) found ${clusters.length} food ${clusters.length === 1 ? "cluster" : "clusters"}: ` +
      `groups of at least ${settings.minPoints} places within ${settings.epsM} m of each other. ` +
      `The biggest is in ${biggest.area} with ${biggest.places} places; ${noisePlaces} places stand alone.`,
  );
  const gemAreas = clusters.filter((c) => c.isHiddenGemArea);
  for (const c of gemAreas.slice(0, 2)) {
    findings.push(
      `The cluster in ${c.area} (${c.places} places) is a hidden gem area: rated ` +
        `${oneDecimal(c.averageRating)} on average, and half of its rated places have ` +
        `${c.medianReviews} reviews or fewer.`,
    );
  }
  return findings;
}

export {
  dbscan,
  findFoodClusters,
  describeFoodClusters,
  haversineMeters,
  DEFAULT_CLUSTERING,
  NOISE,
};
