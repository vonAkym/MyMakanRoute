// Landing page top bar: wordmark, page links (active one underlined in orange), search,
// saved places count and profile. Below 900px the links fold into a menu button.

import { useEffect, useId, useRef, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { Heart, Menu, Search, UserRound, X } from "lucide-react";
import { NAV_LINKS } from "../../data/landingContent";
import { useAuth } from "../../context/AuthContext";
import useSavedPlaces from "../../hooks/useSavedPlaces";
import useReducedMotion from "../../hooks/useReducedMotion";
import Button from "./Button";
import Wordmark from "./Wordmark";
import scrollToSection from "./scrollToSection";
import "./Navbar.css";

const SEARCH_MAX_LENGTH = 100;
const DESKTOP_QUERY = "(min-width: 900px)"; // same breakpoint as the menu button in Navbar.css

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { user } = useAuth();
  const { count } = useSavedPlaces();
  const reducedMotion = useReducedMotion();
  const navigate = useNavigate();
  const headerRef = useRef(null);
  const searchButtonRef = useRef(null);
  const menuButtonRef = useRef(null);
  const menuId = useId();
  const searchId = useId();

  // Escape closes the menu and the search box.
  useEffect(() => {
    if (!menuOpen && !searchOpen) return undefined;
    function onKeyDown(e) {
      if (e.key !== "Escape") return;
      // Give focus back to the button that opened the panel, so keyboard users stay in place.
      if (searchOpen) searchButtonRef.current?.focus();
      else if (menuOpen) menuButtonRef.current?.focus();
      setMenuOpen(false);
      setSearchOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [menuOpen, searchOpen]);

  // The mobile menu closes on a click outside the top bar, and when the window grows to
  // desktop width (where the links show in the bar itself).
  useEffect(() => {
    if (!menuOpen) return undefined;
    function onPointerDown(e) {
      if (!headerRef.current?.contains(e.target)) setMenuOpen(false);
    }
    const desktop =
      typeof window.matchMedia === "function" ? window.matchMedia(DESKTOP_QUERY) : null;
    function onResize(e) {
      if (e.matches) setMenuOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    desktop?.addEventListener("change", onResize);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      desktop?.removeEventListener("change", onResize);
    };
  }, [menuOpen]);

  function onSearchSubmit(e) {
    e.preventDefault();
    // Trim and cap the text; encodeURIComponent keeps it a safe query value.
    const text = query.trim().slice(0, SEARCH_MAX_LENGTH);
    setSearchOpen(false);
    navigate(text ? `/discover?q=${encodeURIComponent(text)}` : "/discover");
  }

  function onAnchorClick(e, id) {
    e.preventDefault();
    setMenuOpen(false);
    scrollToSection(id, reducedMotion);
  }

  return (
    <header ref={headerRef} className="lp-nav">
      <div className="lp-nav__inner">
        <Wordmark />

        <nav aria-label="Main" className="lp-nav__nav">
          <ul id={menuId} className={`lp-nav__links${menuOpen ? " is-open" : ""}`}>
            {NAV_LINKS.map((link) => (
              <li key={link.label}>
                {link.anchor ? (
                  <a
                    href={`#${link.anchor}`}
                    className="lp-nav__link"
                    onClick={(e) => onAnchorClick(e, link.anchor)}
                  >
                    {link.label}
                  </a>
                ) : (
                  <NavLink
                    to={link.to}
                    end={link.to === "/"}
                    className="lp-nav__link"
                    onClick={() => setMenuOpen(false)}
                  >
                    {link.label}
                  </NavLink>
                )}
              </li>
            ))}
          </ul>
        </nav>

        <div className="lp-nav__actions">
          <button
            ref={searchButtonRef}
            type="button"
            className="lp-nav__icon"
            aria-label={searchOpen ? "Close search" : "Search places"}
            aria-expanded={searchOpen}
            aria-controls={searchId}
            onClick={() => setSearchOpen((open) => !open)}
          >
            {searchOpen ? (
              <X size={20} aria-hidden="true" />
            ) : (
              <Search size={20} aria-hidden="true" />
            )}
          </button>
          <Link
            to="/discover?saved=1"
            className="lp-nav__icon lp-nav__saved"
            aria-label={`Saved places (${count})`}
          >
            <Heart size={20} aria-hidden="true" />
            <span className="lp-nav__count" aria-hidden="true">
              {count}
            </span>
          </Link>
          <Link
            to={user ? "/profile" : "/login"}
            className="lp-nav__icon"
            aria-label={user ? "Your profile" : "Log in"}
          >
            <UserRound size={20} aria-hidden="true" />
          </Link>
          <button
            ref={menuButtonRef}
            type="button"
            className="lp-nav__icon lp-nav__menu"
            aria-label="Menu"
            aria-expanded={menuOpen}
            aria-controls={menuId}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
          </button>
        </div>
      </div>

      {searchOpen && (
        <form id={searchId} role="search" className="lp-nav__search" onSubmit={onSearchSubmit}>
          <label htmlFor={`${searchId}-input`} className="visually-hidden">
            Search food places
          </label>
          <Search size={18} aria-hidden="true" className="lp-nav__search-icon" />
          <input
            id={`${searchId}-input`}
            type="search"
            value={query}
            maxLength={SEARCH_MAX_LENGTH}
            placeholder="Search char koay teow, nasi lemak, cendol..."
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <Button type="submit" className="lp-nav__search-go">
            Search
          </Button>
        </form>
      )}
    </header>
  );
}
