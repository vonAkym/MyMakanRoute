// Layout around every page: skip link, top bar (desktop nav), bottom nav (mobile),
// footer with the OpenStreetMap attribution and the sample data note.

import { useEffect, useRef } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { BarChart3, History, LogIn, Route, Search, UserRound } from "lucide-react";
import { useTripBasket } from "../context/TripBasketContext";
import { useAuth } from "../context/AuthContext";
import ErrorBoundary from "./ErrorBoundary";
import BrandMark from "./BrandMark";
import "./AppShell.css";

// At most 5 items so they also fit the mobile bottom bar.
const NAV_ITEMS = [
  { to: "/discover", label: "Discover", icon: Search },
  { to: "/trip", label: "Trip", icon: Route },
  { to: "/trips", label: "My Trips", icon: History },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/profile", label: "Profile", icon: UserRound },
];

// Desktop: 4 small text links (minimal, like the reference); Profile sits at the right.
// Mobile bottom bar: all 5 with icons and labels.
function NavItems({ variant, tripCount }) {
  const items = variant === "top" ? NAV_ITEMS.filter((i) => i.to !== "/profile") : NAV_ITEMS;
  return items.map(({ to, label, icon: Icon }) => (
    <NavLink key={to} to={to} className={`nav-link nav-link--${variant}`}>
      {variant === "bottom" && (
        <span className="nav-link__icon">
          <Icon size={22} aria-hidden="true" />
          {to === "/trip" && tripCount > 0 && (
            <span className="nav-badge" aria-hidden="true">
              {tripCount}
            </span>
          )}
        </span>
      )}
      <span>{label}</span>
      {variant === "top" && to === "/trip" && tripCount > 0 && (
        <span className="nav-count" aria-hidden="true">
          {tripCount}
        </span>
      )}
      {to === "/trip" && tripCount > 0 && (
        <span className="visually-hidden">
          ({tripCount} {tripCount === 1 ? "stop" : "stops"} in your trip)
        </span>
      )}
    </NavLink>
  ));
}

export default function AppShell() {
  const { pathname } = useLocation();
  const { places } = useTripBasket();
  const { user } = useAuth();
  const mainRef = useRef(null);
  const lastPath = useRef(pathname);

  // After a page change, move keyboard/screen reader focus to the new page content.
  useEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    mainRef.current?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      <header className="topbar">
        <div className="container topbar__inner">
          <Link to="/" className="brand" aria-label="MyMakanRoute home">
            <BrandMark size={34} />
            <span className="brand__name">MyMakanRoute</span>
          </Link>
          <nav className="topnav" aria-label="Main">
            <NavItems variant="top" tripCount={places.length} />
          </nav>
          <div className="topbar__account">
            {user ? (
              <NavLink to="/profile" className="nav-link nav-link--top account-link">
                <UserRound size={16} aria-hidden="true" />
                <span className="account-chip__name">{user.displayName}</span>
              </NavLink>
            ) : (
              <NavLink to="/login" className="nav-link nav-link--top account-link">
                <LogIn size={16} aria-hidden="true" />
                Log in
              </NavLink>
            )}
          </div>
        </div>
      </header>

      <main id="main" ref={mainRef} tabIndex={-1} className="app-main">
        <ErrorBoundary key={pathname}>
          <Outlet />
        </ErrorBoundary>
      </main>

      <footer className="footer">
        <div className="container footer__inner">
          <p>
            Map data ©{" "}
            <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
              OpenStreetMap contributors
            </a>
            .
          </p>
          <p>Sample ratings are for testing and are not real reviews.</p>
          <p>MyMakanRoute · CAT405 final year project, Universiti Sains Malaysia</p>
        </div>
      </footer>

      <nav className="bottomnav" aria-label="Main (mobile)">
        <NavItems variant="bottom" tripCount={places.length} />
      </nav>
    </div>
  );
}
