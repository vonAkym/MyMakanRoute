// Safe localStorage helpers: never throw (private mode, full storage, broken JSON).

export function readJson(key, fallback) {
  try {
    const text = window.localStorage.getItem(key);
    return text === null ? fallback : JSON.parse(text);
  } catch {
    return fallback;
  }
}

export function writeJson(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeKey(key) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

// All keys in one place, prefixed so they do not clash with other sites on localhost.
export const STORAGE_KEYS = Object.freeze({
  tripBasket: "mmr.tripBasket.v1",
  savedTrips: "mmr.savedTrips.v1",
  demoAccounts: "mmr.demoAccounts.v1",
  demoSession: "mmr.demoSession.v1",
  preferences: "mmr.preferences.v1",
  savedPlaces: "mmr.savedPlaces.v1",
});
