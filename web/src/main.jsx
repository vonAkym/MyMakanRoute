import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "leaflet/dist/leaflet.css";
import "./styles/tokens.css";
import "./styles/global.css";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { TripBasketProvider } from "./context/TripBasketContext";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <TripBasketProvider>
          <App />
        </TripBasketProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
