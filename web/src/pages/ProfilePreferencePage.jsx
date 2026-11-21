// User Management: Profile and Preference Setup (/profile). Demo mode until Phase 2B.
// Saved preferences become the starting filters on Discover.

import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LogIn, LogOut, Save, UserPlus } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { getPreferences, savePreferences } from "../api/userManagement";
import { DemoModeNote, TextField } from "../components/AuthFormParts";
import usePageTitle from "../hooks/usePageTitle";
import { CUISINES, DIETARY_TAGS } from "../lib/constants";
import { PRICE_LABELS, capitalise } from "../lib/format";
import "./AuthPages.css";
import "../components/FilterPanel.css";

function toggle(list, value) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export default function ProfilePreferencePage() {
  usePageTitle("Profile and preferences");
  const { user, saveProfile, logout } = useAuth();
  const navigate = useNavigate();
  const { state } = useLocation();
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [nameError, setNameError] = useState("");
  const [prefs, setPrefs] = useState(getPreferences);
  const [status, setStatus] = useState(
    state?.welcome ? "Welcome! Set your preferences below." : "",
  );

  async function onSave(e) {
    e.preventDefault();
    setStatus("");
    try {
      if (user) {
        setNameError("");
        await saveProfile({ displayName });
      }
      await savePreferences(prefs);
      setStatus("Saved. Discover will use these preferences as your starting filters.");
    } catch (err) {
      setNameError(err.details?.displayName ?? err.message);
    }
  }

  async function onLogout() {
    await logout();
    navigate("/", { replace: true });
  }

  return (
    <div className="container page">
      <header className="page-header">
        <span className="eyebrow">User Management</span>
        <h1>Profile and preferences</h1>
        <p>Tell MyMakanRoute what you like to eat. Discover starts with these filters.</p>
      </header>

      <div className="profile-layout">
        <section className="card auth-card" aria-labelledby="account-title">
          <h2 id="account-title">Account</h2>
          <DemoModeNote />
          {user ? (
            <>
              <p style={{ margin: 0 }}>
                Logged in as <strong>{user.email}</strong>
              </p>
              <div className="profile-danger">
                <button type="button" className="btn btn-danger" onClick={onLogout}>
                  <LogOut size={18} aria-hidden="true" />
                  Log out
                </button>
              </div>
            </>
          ) : (
            <>
              <p style={{ margin: 0 }}>
                You are not logged in. Preferences still work and are kept on this device.
              </p>
              <div className="profile-actions">
                <Link to="/login" className="btn btn-secondary">
                  <LogIn size={18} aria-hidden="true" />
                  Log in
                </Link>
                <Link to="/register" className="btn btn-primary">
                  <UserPlus size={18} aria-hidden="true" />
                  Create account
                </Link>
              </div>
            </>
          )}
        </section>

        <section className="card" aria-labelledby="prefs-title">
          <h2 id="prefs-title">Food preferences</h2>
          <form onSubmit={onSave} noValidate>
            {user && (
              <TextField
                id="profile-name"
                label="Display name"
                autoComplete="nickname"
                required
                maxLength={50}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                error={nameError}
              />
            )}

            <label className="check">
              <input
                type="checkbox"
                checked={prefs.halalOnly}
                onChange={(e) => setPrefs((p) => ({ ...p, halalOnly: e.target.checked }))}
              />
              Halal only
            </label>

            <div className="field">
              <label htmlFor="pref-budget">Maximum budget</label>
              <select
                id="pref-budget"
                className="select"
                value={prefs.maxBudget ?? ""}
                onChange={(e) =>
                  setPrefs((p) => ({
                    ...p,
                    maxBudget: e.target.value === "" ? null : Number(e.target.value),
                  }))
                }
              >
                <option value="">Any price</option>
                {[1, 2, 3, 4].map((level) => (
                  <option key={level} value={level}>
                    {"RM".repeat(level)} · {PRICE_LABELS[level]}
                  </option>
                ))}
              </select>
            </div>

            <fieldset>
              <legend>Favourite cuisines</legend>
              <div className="chip-group">
                {CUISINES.map((c) => (
                  <label key={c} className="chip">
                    <input
                      type="checkbox"
                      checked={prefs.cuisines.includes(c)}
                      onChange={() => setPrefs((p) => ({ ...p, cuisines: toggle(p.cuisines, c) }))}
                    />
                    {capitalise(c)}
                  </label>
                ))}
              </div>
              <p className="field-hint" style={{ marginTop: "var(--space-xs)" }}>
                Discover shows places matching any of the chosen cuisines.
              </p>
            </fieldset>

            <fieldset>
              <legend>Dietary needs</legend>
              <div className="chip-group">
                {DIETARY_TAGS.map((d) => (
                  <label key={d} className="chip">
                    <input
                      type="checkbox"
                      checked={prefs.dietary.includes(d)}
                      onChange={() => setPrefs((p) => ({ ...p, dietary: toggle(p.dietary, d) }))}
                    />
                    {capitalise(d)}
                  </label>
                ))}
              </div>
            </fieldset>

            <button type="submit" className="btn btn-primary">
              <Save size={18} aria-hidden="true" />
              Save preferences
            </button>
            <p
              role="status"
              className={status ? "notice notice-success" : ""}
              style={{ marginTop: "var(--space-sm)" }}
            >
              {status}
            </p>
          </form>
        </section>
      </div>
    </div>
  );
}
