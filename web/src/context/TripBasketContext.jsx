// Itinerary Planner: the trip basket (places the user picked on Discover).
// Kept in React context so every page sees it, and in localStorage so a page reload
// does not lose it.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { readJson, writeJson, STORAGE_KEYS } from "../lib/storage";

export const MAX_TRIP_STOPS = 10; // same limit as POST /api/hopping/route

const TripBasketContext = createContext(null);

// Only the fields the trip pages need are kept.
function toBasketPlace(place) {
  return {
    id: place.id,
    name: place.name,
    lat: Number(place.lat),
    lng: Number(place.lng),
    cuisine: place.cuisine ?? null,
    area: place.area ?? null,
    avgRating: place.avgRating ?? null,
    reviewCount: place.reviewCount ?? null,
    priceLevel: place.priceLevel ?? null,
    isHalal: place.isHalal ?? null,
    label: place.label ?? null,
    isSample: place.isSample === true,
  };
}

function loadBasket() {
  const saved = readJson(STORAGE_KEYS.tripBasket, []);
  // Keep only places with a string id and real coordinates (the map and route need them).
  return Array.isArray(saved)
    ? saved
        .filter(
          (p) => p && typeof p.id === "string" && Number.isFinite(p.lat) && Number.isFinite(p.lng),
        )
        .slice(0, MAX_TRIP_STOPS)
    : [];
}

// Moves the item at index `from` to index `to` (pure helper, exported for tests).
export function moveItem(list, from, to) {
  if (from === to || to < 0 || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function TripBasketProvider({ children }) {
  const [places, setPlaces] = useState(loadBasket);

  useEffect(() => {
    writeJson(STORAGE_KEYS.tripBasket, places);
  }, [places]);

  // Returns true when the place was added (false if already in the basket or full).
  const addPlace = useCallback(
    (place) => {
      const canAdd = (list) => !list.some((p) => p.id === place.id) && list.length < MAX_TRIP_STOPS;
      if (!canAdd(places)) return false;
      setPlaces((current) => (canAdd(current) ? [...current, toBasketPlace(place)] : current));
      return true;
    },
    [places],
  );

  const removePlace = useCallback((id) => {
    setPlaces((current) => current.filter((p) => p.id !== id));
  }, []);

  const movePlace = useCallback((id, direction) => {
    setPlaces((current) => {
      const index = current.findIndex((p) => p.id === id);
      return index === -1 ? current : moveItem(current, index, index + direction);
    });
  }, []);

  // Replace the whole order (e.g. with the order ACO found).
  const setOrder = useCallback((ids) => {
    setPlaces((current) => {
      const byId = new Map(current.map((p) => [p.id, p]));
      const ordered = ids.map((id) => byId.get(id)).filter(Boolean);
      const rest = current.filter((p) => !ids.includes(p.id));
      return [...ordered, ...rest];
    });
  }, []);

  const clearBasket = useCallback(() => setPlaces([]), []);

  const value = useMemo(
    () => ({
      places,
      isFull: places.length >= MAX_TRIP_STOPS,
      hasPlace: (id) => places.some((p) => p.id === id),
      addPlace,
      removePlace,
      movePlace,
      setOrder,
      clearBasket,
    }),
    [places, addPlace, removePlace, movePlace, setOrder, clearBasket],
  );

  return <TripBasketContext.Provider value={value}>{children}</TripBasketContext.Provider>;
}

export function useTripBasket() {
  const value = useContext(TripBasketContext);
  if (!value) throw new Error("useTripBasket must be used inside <TripBasketProvider>");
  return value;
}
