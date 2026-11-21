// Routes. Each page belongs to one module of the proposal.
// Pages are loaded on demand (React.lazy), so the map (Leaflet) and chart (Recharts)
// code only downloads when a page needs it.

import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import AppShell from "./components/AppShell";
import HomePage from "./pages/HomePage";
import LoadingSkeleton from "./components/LoadingSkeleton";

const FoodDiscoveryPage = lazy(() => import("./pages/FoodDiscoveryPage"));
const ItineraryPlannerPage = lazy(() => import("./pages/ItineraryPlannerPage"));
const PastFoodHoppingPage = lazy(() => import("./pages/PastFoodHoppingPage"));
const FoodStallsAnalyticsPage = lazy(() => import("./pages/FoodStallsAnalyticsPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const RegistrationPage = lazy(() => import("./pages/RegistrationPage"));
const ProfilePreferencePage = lazy(() => import("./pages/ProfilePreferencePage"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));

// Wraps a lazy page with a loading placeholder.
function page(Component) {
  return (
    <Suspense
      fallback={
        <div className="container page">
          <LoadingSkeleton count={3} height={120} label="Loading page" />
        </div>
      }
    >
      <Component />
    </Suspense>
  );
}

export default function App() {
  return (
    <Routes>
      {/* Landing page: full screen, has its own Navbar, so it sits outside AppShell. */}
      <Route index element={<HomePage />} />
      <Route element={<AppShell />}>
        {/* Food Discovery */}
        <Route path="discover" element={page(FoodDiscoveryPage)} />
        {/* Food Hopping */}
        <Route path="trip" element={page(ItineraryPlannerPage)} />
        <Route path="trips" element={page(PastFoodHoppingPage)} />
        {/* Food Stalls Analytics */}
        <Route path="analytics" element={page(FoodStallsAnalyticsPage)} />
        {/* User Management */}
        <Route path="login" element={page(LoginPage)} />
        <Route path="register" element={page(RegistrationPage)} />
        <Route path="profile" element={page(ProfilePreferencePage)} />
        <Route path="*" element={page(NotFoundPage)} />
      </Route>
    </Routes>
  );
}
