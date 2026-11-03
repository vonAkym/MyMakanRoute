// Landing page (/): dark food guide front door. Not a submodule: it leads to Food Discovery,
// Food Hopping, Food Stalls Analytics and User Management. Sits outside AppShell because it
// has its own Navbar and Footer. Plan: docs/plans/landing-page.md.

import Navbar from "../components/landing/Navbar";
import Hero from "../components/landing/Hero";
import PlaceGrid from "../components/landing/PlaceGrid";
import HowItWorks from "../components/landing/HowItWorks";
import Testimonials from "../components/landing/Testimonials";
import Footer from "../components/landing/Footer";
import usePageTitle from "../hooks/usePageTitle";
import "./HomePage.css";

export default function HomePage() {
  usePageTitle(null);
  return (
    <div className="landing">
      <a className="skip-link" href="#landing-main">
        Skip to main content
      </a>
      <Navbar />
      <main id="landing-main" tabIndex={-1} className="landing__main">
        <Hero />
        <PlaceGrid />
        <HowItWorks />
        <Testimonials />
      </main>
      <Footer />
    </div>
  );
}
