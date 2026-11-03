// User Management: Registration (/register). Demo mode until Phase 2B.

import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { UserPlus } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { PASSWORD_MIN_LENGTH, validateRegistration } from "../api/userManagement";
import { DemoModeNote, PasswordField, TextField } from "../components/AuthFormParts";
import usePageTitle from "../hooks/usePageTitle";
import "./AuthPages.css";

const FIELD_LABELS = { displayName: "Display name", email: "Email", password: "Password" };

export default function RegistrationPage() {
  usePageTitle("Create an account");
  const { register } = useAuth();
  const navigate = useNavigate();
  const [values, setValues] = useState({ displayName: "", email: "", password: "" });
  const [touched, setTouched] = useState({});
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const summaryRef = useRef(null);

  const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }));

  // Validate a field when the user leaves it (not on every key press).
  const blur = (key) => () => {
    setTouched((t) => ({ ...t, [key]: true }));
    setErrors(validateRegistration(values));
  };

  async function onSubmit(e) {
    e.preventDefault();
    const found = validateRegistration(values);
    setErrors(found);
    setTouched({ displayName: true, email: true, password: true });
    if (Object.keys(found).length > 0) {
      setFormError("");
      setTimeout(() => summaryRef.current?.focus(), 0);
      return;
    }
    setSubmitting(true);
    try {
      await register(values);
      navigate("/profile", { replace: true, state: { welcome: true } });
    } catch (err) {
      setErrors(err.details ?? {});
      setFormError(err.message);
      setTimeout(() => summaryRef.current?.focus(), 0);
    } finally {
      setSubmitting(false);
    }
  }

  const shown = (key) => (touched[key] ? errors[key] : undefined);
  const summaryItems = Object.entries(errors).filter(([key]) => touched[key]);

  return (
    <div className="container page auth-page">
      <header className="page-header">
        <span className="eyebrow">User Management</span>
        <h1>Create an account</h1>
        <p>Save your food preferences so Discover can use them.</p>
      </header>
      <div className="card auth-card">
        <DemoModeNote />
        {(summaryItems.length > 0 || formError) && (
          <div ref={summaryRef} className="error-summary" tabIndex={-1} role="alert">
            <p>{formError || "Please fix these fields:"}</p>
            {summaryItems.length > 0 && (
              <ul>
                {summaryItems.map(([key, message]) => (
                  <li key={key}>
                    <a href={`#reg-${key}`}>
                      {FIELD_LABELS[key]}: {message}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        <form onSubmit={onSubmit} noValidate>
          <TextField
            id="reg-displayName"
            label="Display name"
            autoComplete="nickname"
            required
            value={values.displayName}
            onChange={set("displayName")}
            onBlur={blur("displayName")}
            error={shown("displayName")}
          />
          <TextField
            id="reg-email"
            label="Email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            value={values.email}
            onChange={set("email")}
            onBlur={blur("email")}
            error={shown("email")}
          />
          <PasswordField
            id="reg-password"
            autoComplete="new-password"
            hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}
            value={values.password}
            onChange={set("password")}
            onBlur={blur("password")}
            error={shown("password")}
          />
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            <UserPlus size={18} aria-hidden="true" />
            {submitting ? "Creating account…" : "Create account"}
          </button>
        </form>
        <p className="small" style={{ margin: 0 }}>
          Already registered? <Link to="/login">Log in</Link>
        </p>
      </div>
    </div>
  );
}
