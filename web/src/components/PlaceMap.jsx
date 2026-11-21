// Food Place Visualisation: Leaflet map with OpenStreetMap tiles (no API key).
// Shows place markers (hidden gems look different), an optional search centre and radius,
// and optional route lines with numbered stops (Food Hopping).

import { useEffect, useMemo } from "react";
import L from "leaflet";
import { Circle, MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import LabelBadge from "./LabelBadge";
import { formatRating } from "../lib/format";
import { PENANG_CENTRE } from "../lib/constants";
import "./PlaceMap.css";

// Small inline SVGs (Lucide "gem" and "flame" shapes) for the marker icons.
const GEM_SVG =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h12l4 6-10 13L2 9Z"/><path d="M11 3 8 9l4 13 4-13-3-6"/><path d="M2 9h20"/></svg>';
const FLAME_SVG =
  '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>';

// Marker icon (Leaflet divIcon = plain HTML, so no image files are needed).
function placeIcon(place, { active, number }) {
  let kind = "plain";
  let inner = "";
  if (number != null) {
    kind = "number";
    inner = String(number);
  } else if (place.label === "Hidden Gem") {
    kind = "gem";
    inner = GEM_SVG;
  } else if (place.label === "Popular") {
    kind = "popular";
    inner = FLAME_SVG;
  }
  const size = kind === "gem" || kind === "number" ? 34 : 28;
  return L.divIcon({
    className: "map-pin-wrap",
    html: `<span class="map-pin map-pin--${kind}${active ? " map-pin--active" : ""}">${inner}</span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

const centreIcon = L.divIcon({
  className: "map-pin-wrap",
  html: '<span class="map-centre" aria-hidden="true"></span>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

// Fits the map to the given points whenever `fitKey` changes.
function FitToPoints({ points, fitKey }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], Math.max(map.getZoom(), 15));
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [32, 32], maxZoom: 16 });
    // Only refit when the key changes, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, map]);
  return null;
}

// Pans to the selected place.
function PanToSelected({ place }) {
  const map = useMap();
  useEffect(() => {
    if (place) map.panTo([place.lat, place.lng], { animate: true });
  }, [place, map]);
  return null;
}

// Leaflet measures its box once; when a hidden map (mobile toggle) becomes visible
// it must measure again.
function ResizeWhenVisible({ visible }) {
  const map = useMap();
  useEffect(() => {
    if (visible) setTimeout(() => map.invalidateSize(), 0);
  }, [visible, map]);
  return null;
}

export default function PlaceMap({
  places = [],
  centre,
  radius,
  selectedId,
  hoveredId,
  onSelect,
  onHover,
  legs = [],
  numbered = false,
  visible = true,
  label = "Map of food places",
}) {
  const points = useMemo(() => {
    const p = places.map((x) => [x.lat, x.lng]);
    if (centre && !numbered) p.push([centre.lat, centre.lng]);
    return p;
  }, [places, centre, numbered]);
  const fitKey = useMemo(
    () => places.map((p) => p.id).join(",") + (centre ? `@${centre.lat},${centre.lng}` : ""),
    [places, centre],
  );
  const selected = places.find((p) => p.id === selectedId) ?? null;
  const start = centre ? [centre.lat, centre.lng] : PENANG_CENTRE;

  return (
    <div className="place-map" role="region" aria-label={label}>
      <MapContainer center={start} zoom={15} scrollWheelZoom className="place-map__map">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitToPoints points={points} fitKey={fitKey} />
        <PanToSelected place={selected} />
        <ResizeWhenVisible visible={visible} />

        {centre && radius && !numbered && (
          <Circle
            center={[centre.lat, centre.lng]}
            radius={radius}
            pathOptions={{ className: "map-radius" }}
          />
        )}
        {centre && !numbered && (
          <Marker
            position={[centre.lat, centre.lng]}
            icon={centreIcon}
            keyboard={false}
            interactive={false}
          />
        )}

        {legs.map((leg, i) => (
          <Polyline
            key={`${leg.fromId}-${leg.toId}-${i}`}
            positions={leg.path}
            pathOptions={{ className: "map-route" }}
          />
        ))}

        {places.map((place, index) => (
          <Marker
            key={place.id}
            position={[place.lat, place.lng]}
            icon={placeIcon(place, {
              active: place.id === selectedId || place.id === hoveredId,
              number: numbered ? index + 1 : null,
            })}
            title={`${numbered ? `Stop ${index + 1}: ` : ""}${place.name}${
              place.label ? ` (${place.label})` : ""
            }`}
            zIndexOffset={place.id === selectedId || place.id === hoveredId ? 1000 : 0}
            eventHandlers={{
              click: () => onSelect?.(place.id),
              mouseover: () => onHover?.(place.id),
              mouseout: () => onHover?.(null),
            }}
          >
            <Popup>
              <div className="map-popup">
                <strong>
                  {numbered ? `${index + 1}. ` : ""}
                  {place.name}
                </strong>
                <LabelBadge label={place.label} size="sm" />
                <span>
                  Rating {formatRating(place.avgRating)}
                  {place.avgRating != null ? ` (${place.reviewCount ?? 0} reviews)` : ""}
                </span>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
