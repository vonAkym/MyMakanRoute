// User Management API: Registration, Login, Profile and Preference Setup.
//
// DEMO MODE. Real accounts (Supabase Auth through POST /api/auth/register, /login,
// /refresh) arrive in Phase 2B. Until then this file keeps a demo user in this browser's
// localStorage. All demo-mode code is in THIS file, so Phase 2B only has to replace the
// function bodies with apiRequest() calls; the pages keep the same function names.
//
// Passwords are NEVER stored: in demo mode they are only checked for length.

import { readJson, writeJson, removeKey, STORAGE_KEYS } from "../lib/storage";
import { ApiError } from "./client";

export const DEMO_MODE = true;
export const PASSWORD_MIN_LENGTH = 8;

export const DEFAULT_PREFERENCES = Object.freeze({
  halalOnly: false,
  maxBudget: null, // 1 to 4 (price level), or null for any
  cuisines: [],
  dietary: [],
});

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normaliseEmail = (email) =>
  String(email ?? "")
    .trim()
    .toLowerCase();

// Input checks shared by the forms and this file (the real backend will check again).
export function validateRegistration({ displayName, email, password }) {
  const errors = {};
  const name = String(displayName ?? "").trim();
  if (name.length < 2) errors.displayName = "Enter a display name of at least 2 characters.";
  else if (name.length > 50) errors.displayName = "Display name must be 50 characters or fewer.";
  if (!EMAIL_PATTERN.test(normaliseEmail(email))) {
    errors.email = "Enter a valid email address, for example aminah@example.com.";
  }
  if (String(password ?? "").length < PASSWORD_MIN_LENGTH) {
    errors.password = `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  return errors;
}

export function validateLogin({ email, password }) {
  const errors = {};
  if (!EMAIL_PATTERN.test(normaliseEmail(email))) errors.email = "Enter a valid email address.";
  if (!password) errors.password = "Enter your password.";
  return errors;
}

// Registration (demo): remembers { email, displayName } on this device and logs in.
export async function registerUser({ displayName, email, password }) {
  const errors = validateRegistration({ displayName, email, password });
  if (Object.keys(errors).length > 0) {
    throw new ApiError("Please fix the highlighted fields.", {
      code: "VALIDATION_ERROR",
      details: errors,
    });
  }
  const accounts = loadAccounts();
  const cleanEmail = normaliseEmail(email);
  if (accounts.some((a) => a.email === cleanEmail)) {
    throw new ApiError("An account with this email already exists. Log in instead.", {
      code: "CONFLICT",
      details: { email: "This email is already registered on this device." },
    });
  }
  const user = { email: cleanEmail, displayName: displayName.trim(), role: "user" };
  writeJson(STORAGE_KEYS.demoAccounts, [...accounts, user]);
  writeJson(STORAGE_KEYS.demoSession, user);
  return user;
}

// Login (demo): any demo account registered on this device; the password is not checked.
export async function loginUser({ email, password }) {
  const errors = validateLogin({ email, password });
  if (Object.keys(errors).length > 0) {
    throw new ApiError("Please fix the highlighted fields.", {
      code: "VALIDATION_ERROR",
      details: errors,
    });
  }
  const accounts = loadAccounts();
  const user = accounts.find((a) => a.email === normaliseEmail(email));
  if (!user) {
    throw new ApiError("No demo account with this email on this device. Register first.", {
      code: "UNAUTHORISED",
    });
  }
  writeJson(STORAGE_KEYS.demoSession, user);
  return user;
}

export async function logoutUser() {
  removeKey(STORAGE_KEYS.demoSession);
}

// The logged-in user, or null. A stored session with the wrong shape (edited by hand or
// left by an older version) is dropped instead of crashing the app.
export function getCurrentUser() {
  const user = readJson(STORAGE_KEYS.demoSession, null);
  if (user && typeof user === "object" && typeof user.email === "string") return user;
  if (user !== null) removeKey(STORAGE_KEYS.demoSession);
  return null;
}

// Demo accounts on this device; entries without a string email are ignored.
function loadAccounts() {
  const accounts = readJson(STORAGE_KEYS.demoAccounts, []);
  return Array.isArray(accounts)
    ? accounts.filter((a) => a && typeof a === "object" && typeof a.email === "string")
    : [];
}

// Profile (demo): change the display name of the logged-in user.
export async function updateProfile({ displayName }) {
  const user = getCurrentUser();
  if (!user) throw new ApiError("Log in to edit your profile.", { code: "UNAUTHORISED" });
  const name = String(displayName ?? "").trim();
  if (name.length < 2 || name.length > 50) {
    throw new ApiError("Display name must be 2 to 50 characters.", {
      code: "VALIDATION_ERROR",
      details: { displayName: "Display name must be 2 to 50 characters." },
    });
  }
  const updated = { ...user, displayName: name };
  const accounts = loadAccounts();
  writeJson(
    STORAGE_KEYS.demoAccounts,
    accounts.map((a) => (a.email === user.email ? updated : a)),
  );
  writeJson(STORAGE_KEYS.demoSession, updated);
  return updated;
}

// Preference Setup: works without logging in too (kept per device).
export function getPreferences() {
  const saved = readJson(STORAGE_KEYS.preferences, null);
  return saved ? { ...DEFAULT_PREFERENCES, ...saved } : { ...DEFAULT_PREFERENCES };
}

export async function savePreferences(preferences) {
  const maxBudget = Number(preferences.maxBudget);
  const clean = {
    halalOnly: preferences.halalOnly === true,
    maxBudget: Number.isInteger(maxBudget) && maxBudget >= 1 && maxBudget <= 4 ? maxBudget : null,
    cuisines: (preferences.cuisines ?? []).map((c) => String(c).toLowerCase()).slice(0, 10),
    dietary: (preferences.dietary ?? []).map((d) => String(d).toLowerCase()).slice(0, 10),
  };
  writeJson(STORAGE_KEYS.preferences, clean);
  return clean;
}

// True when the user set at least one preference (Discover then uses them as filters).
export function hasPreferences(preferences) {
  return (
    preferences.halalOnly ||
    preferences.maxBudget != null ||
    preferences.cuisines.length > 0 ||
    preferences.dietary.length > 0
  );
}
