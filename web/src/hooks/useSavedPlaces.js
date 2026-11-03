// Landing page: ids of places the user saved, kept in localStorage so they survive a
// refresh. Every component that uses this hook (save buttons, navbar count) sees the same
// list, because they all read one shared store through useSyncExternalStore.

import { useCallback, useSyncExternalStore } from "react";
import { STORAGE_KEYS, writeJson } from "../lib/storage";

const KEY = STORAGE_KEYS.savedPlaces;
const listeners = new Set();
const EMPTY = Object.freeze([]);

// Cache by the raw stored text so React gets the same array until something changes.
let lastText = null;
let lastValue = EMPTY;
// Used only when localStorage cannot be written (private mode, storage full): the hearts
// still work for this visit, they are just not remembered after a refresh.
let memoryIds = null;

function parseIds(text) {
  try {
    const value = JSON.parse(text);
    return Array.isArray(value) ? value.filter((id) => typeof id === "string") : EMPTY;
  } catch {
    return EMPTY;
  }
}

function getSnapshot() {
  if (memoryIds !== null) return memoryIds;
  let text = null;
  try {
    text = window.localStorage.getItem(KEY);
  } catch {
    text = null; // storage blocked (private mode): behave as empty
  }
  if (text !== lastText) {
    lastText = text;
    lastValue = text === null ? EMPTY : parseIds(text);
  }
  return lastValue;
}

function subscribe(onChange) {
  listeners.add(onChange);
  // Another tab changed the list.
  const onStorage = (e) => {
    if (e.key === KEY || e.key === null) onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

function notify() {
  for (const fn of listeners) fn();
}

export default function useSavedPlaces() {
  const ids = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);

  const toggleSaved = useCallback((id) => {
    const current = getSnapshot();
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    memoryIds = writeJson(KEY, next) ? null : Object.freeze(next);
    notify();
  }, []);

  const isSaved = useCallback((id) => ids.includes(id), [ids]);

  return { savedIds: ids, count: ids.length, isSaved, toggleSaved };
}
