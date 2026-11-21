// Shared pieces for the Registration, Login and Profile forms.

import { useState } from "react";
import { Eye, EyeOff, FlaskConical } from "lucide-react";

// Visible note that accounts are not real yet (Phase 2B adds Supabase Auth).
export function DemoModeNote() {
  return (
    <div className="notice" role="note">
      <FlaskConical size={18} aria-hidden="true" />
      <p style={{ margin: 0 }}>
        <strong>Demo mode</strong> — real accounts arrive in Phase 2B. Your details stay in this
        browser only. Passwords are not checked and are never stored.
      </p>
    </div>
  );
}

// Text field with label, optional hint and an error linked by aria-describedby.
export function TextField({ id, label, error, hint, required, ...inputProps }) {
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ");
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {required && (
          <span className="required" aria-hidden="true">
            {" "}
            *
          </span>
        )}
      </label>
      <input
        id={id}
        className="input"
        required={required}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={describedBy || undefined}
        {...inputProps}
      />
      {hint && (
        <p id={`${id}-hint`} className="field-hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}

// Password field with a show/hide button. Paste and password managers are allowed.
export function PasswordField({ id, label = "Password", error, hint, ...inputProps }) {
  const [visible, setVisible] = useState(false);
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ");
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        <span className="required" aria-hidden="true">
          {" "}
          *
        </span>
      </label>
      <div className="password-field">
        <input
          id={id}
          className="input"
          type={visible ? "text" : "password"}
          required
          aria-invalid={error ? "true" : undefined}
          aria-describedby={describedBy || undefined}
          {...inputProps}
        />
        <button
          type="button"
          className="icon-btn password-field__toggle"
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          onClick={() => setVisible((v) => !v)}
        >
          {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
        </button>
      </div>
      {hint && (
        <p id={`${id}-hint`} className="field-hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}
