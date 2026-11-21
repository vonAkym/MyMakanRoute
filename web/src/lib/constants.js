// Fixed lists used by the pages.

// Preset Penang spots for Food Place Searching. Coordinates come from places in
// data/osm-penang.json (OpenStreetMap), not invented:
//   Komtar        - Top View Restaurant, Komtar (5.4145, 100.3299); the plan uses 5.4145, 100.3292
//   Penang Road   - Penang Road Famous Laksa, Lebuh Keng Kwee (5.4167, 100.3311)
//   Gurney Drive  - Kompleks Makanan, Persiaran Gurney (5.4341, 100.3149)
//   Pulau Tikus   - Pulau Tikus Wantan Mee House, Jalan Burma (5.4305, 100.3126)
//   USM Gelugor   - Richiamo Coffee, USM (5.3573, 100.3064)
export const LOCATION_PRESETS = Object.freeze([
  { id: "komtar", name: "Komtar", lat: 5.4145, lng: 100.3292 },
  { id: "penang-road", name: "Penang Road", lat: 5.4167, lng: 100.3311 },
  { id: "gurney", name: "Gurney Drive", lat: 5.4341, lng: 100.3149 },
  { id: "pulau-tikus", name: "Pulau Tikus", lat: 5.4305, lng: 100.3126 },
  { id: "usm", name: "USM Gelugor", lat: 5.3573, lng: 100.3064 },
]);

// Cuisines found in the sample data (lower case, as the API expects).
export const CUISINES = Object.freeze([
  "chinese",
  "malay",
  "indian",
  "nasi kandar",
  "mamak",
  "nyonya",
  "hawker",
  "seafood",
  "cafe",
  "dessert",
  "japanese",
  "thai",
  "western",
]);

export const DIETARY_TAGS = Object.freeze(["vegetarian", "vegan"]);

export const RADIUS_MIN = 100;
export const RADIUS_MAX = 5000;
export const RADIUS_DEFAULT = 1500;

export const PENANG_CENTRE = Object.freeze([5.4145, 100.3292]);
