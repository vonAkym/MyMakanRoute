// Landing footer: logo + line + icons, quick links, contact, newsletter; then a thin orange
// line, copyright and legal text. The newsletter form is UI only: it checks the email
// format and sends NOTHING anywhere (this is a prototype).

import { useId, useState } from "react";
import { Link } from "react-router-dom";
import { Mail, MapPin, Send } from "lucide-react";
import { FOOTER } from "../../data/landingContent";
import Wordmark from "./Wordmark";
import "./Footer.css";

// Simple email check: something@something.tld, no spaces. Max 254 chars (email limit).
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export function isValidEmail(value) {
  const text = String(value ?? "").trim();
  return text.length <= 254 && EMAIL_PATTERN.test(text);
}

function SocialIcons({ items }) {
  const [status, setStatus] = useState("");

  // Share: the phone/OS share sheet when the browser has one, else copy the link.
  async function onShare() {
    // Share the home page only (never the current URL with its query or hash).
    const url = `${window.location.origin}/`;
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: "MyMakanRoute", url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setStatus("Link copied");
    } catch (err) {
      if (err?.name === "AbortError") return; // user closed the share sheet
      setStatus("Could not copy the link");
    }
  }

  return (
    <>
      <ul className="lp-footer__social">
        {items.map(({ id, icon: Icon, label, type, href }) => (
          <li key={id}>
            {type === "share" ? (
              <button
                type="button"
                className="lp-footer__icon"
                aria-label={label}
                onClick={onShare}
              >
                <Icon size={18} aria-hidden="true" />
              </button>
            ) : (
              <a href={href} className="lp-footer__icon" aria-label={label}>
                <Icon size={18} aria-hidden="true" />
              </a>
            )}
          </li>
        ))}
      </ul>
      <p className="lp-footer__status" role="status" aria-live="polite">
        {status}
      </p>
    </>
  );
}

function NewsletterForm({ content }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submits, setSubmits] = useState(0);
  const inputId = useId();
  const errorId = useId();

  function onSubmit(e) {
    e.preventDefault();
    setMessage("");
    if (!isValidEmail(email)) {
      setError("Please enter a valid email address, e.g. name@example.com.");
      return;
    }
    setError("");
    setMessage(content.unavailable); // nothing is sent
    setSubmits((n) => n + 1);
  }

  return (
    <form className="lp-newsletter" onSubmit={onSubmit} noValidate>
      <label htmlFor={inputId} className="visually-hidden">
        Email address
      </label>
      <div className="lp-newsletter__row">
        <input
          id={inputId}
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="Your email"
          maxLength={254}
          value={email}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button type="submit" className="lp-newsletter__submit" aria-label="Subscribe">
          <Send size={18} aria-hidden="true" />
        </button>
      </div>
      {error && (
        <p id={errorId} className="lp-newsletter__error" role="alert">
          {error}
        </p>
      )}
      <p className="lp-newsletter__message" role="status" aria-live="polite">
        {/* New key each submit: the text node is replaced, so screen readers announce it again. */}
        {message && <span key={submits}>{message}</span>}
      </p>
    </form>
  );
}

export default function Footer({ content = FOOTER }) {
  return (
    <footer className="lp-footer">
      <div className="lp-container">
        <div className="lp-footer__grid">
          <div className="lp-footer__col lp-footer__about">
            <Wordmark size="footer" />
            <p className="lp-footer__text">{content.tagline}</p>
            <SocialIcons items={content.social} />
          </div>

          <nav className="lp-footer__col" aria-labelledby="lp-footer-links">
            <h2 id="lp-footer-links" className="lp-footer__heading">
              Quick Links
            </h2>
            <ul className="lp-footer__list">
              {content.quickLinks.map((link) => (
                <li key={link.to}>
                  <Link to={link.to} className="lp-footer__link">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="lp-footer__col">
            <h2 className="lp-footer__heading">Contact</h2>
            <ul className="lp-footer__list">
              <li className="lp-footer__contact">
                <Mail size={16} aria-hidden="true" />
                <a href={`mailto:${content.email}`} className="lp-footer__link">
                  {content.email}
                </a>
              </li>
              <li className="lp-footer__contact">
                <MapPin size={16} aria-hidden="true" />
                <span>{content.location}</span>
              </li>
            </ul>
          </div>

          <div className="lp-footer__col">
            <h2 className="lp-footer__heading">{content.newsletter.title}</h2>
            <p className="lp-footer__text">{content.newsletter.text}</p>
            <NewsletterForm content={content.newsletter} />
          </div>
        </div>

        <div className="lp-footer__bottom">
          <div>
            <p>{content.copyright}</p>
            <p className="lp-footer__credit">{content.photoCredit}</p>
          </div>
          <p className="lp-footer__legal">
            {content.legal.map((item, i) => (
              <span key={item}>
                {i > 0 && (
                  <span className="lp-footer__sep" aria-hidden="true">
                    |
                  </span>
                )}
                {item}
              </span>
            ))}
            <span className="visually-hidden"> (pages not available yet)</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
