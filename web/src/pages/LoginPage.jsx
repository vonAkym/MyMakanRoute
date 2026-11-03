// User Management: Login (/login). Demo mode until Phase 2B.

import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LogIn } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { validateLogin } from "../api/userManagement";
import { DemoModeNote, PasswordField, TextField } from "../components/AuthFormParts";
import usePageTitle from "../hooks/usePageTitle";
import "./AuthPages.css";

export default function LoginPage() {
  usePageTitle("Log in");
  const { login } = useAuth();
  const navigate = useNavigate();
  const [values, setValues] = useState({ email: "", password: "" });
  const [touched, setTouched] = useState({});
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const summaryRef = useRef(null);

  const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }));
  const blur = (key) => () => {
    setTouched((t) => ({ ...t, [key]: true }));
    setErrors(validateLogin(values));
  };

  async function onSubmit(e) {
    e.preventDefault();
    const found = validateLogin(values);
    setErrors(found);
    setTouched({ email: true, password: true });
    if (Object.keys(found).length > 0) return;
    setSubmitting(true);
    setFormError("");
    try {
      await login(values);
      navigate("/discover", { replace: true });
    } catch (err) {
      setFormError(err.message);
      setTimeout(() => summaryRef.current?.focus(), 0);
    } finally {
      setSubmitting(false);
    }
  }

  const shown = (key) => (touched[key] ? errors[key] : undefined);

  return (
    <div className="container page auth-page">
      <header className="page-header">
        <span className="eyebrow">User Management</span>
        <h1>Log in</h1>
      </header>
      <div className="card auth-card">
        <DemoModeNote />
        {formError && (
          <div ref={summaryRef} className="error-summary" tabIndex={-1} role="alert">
            <p>{formError}</p>
          </div>
        )}
        <form onSubmit={onSubmit} noValidate>
          <TextField
            id="login-email"
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
            id="login-password"
            autoComplete="current-password"
            value={values.password}
            onChange={set("password")}
            onBlur={blur("password")}
            error={shown("password")}
          />
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            <LogIn size={18} aria-hidden="true" />
            {submitting ? "Logging in…" : "Log in"}
          </button>
        </form>
        <p className="small" style={{ margin: 0 }}>
          New here? <Link to="/register">Create an account</Link>
        </p>
      </div>
    </div>
  );
}
