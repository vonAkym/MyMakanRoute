// "MyMakanRoute" wordmark (with "Makan" in orange), linking home. Used by the landing
// Navbar and Footer. size: "nav" | "footer".

import { Link } from "react-router-dom";
import "./Wordmark.css";

export default function Wordmark({ size = "nav" }) {
  return (
    <Link to="/" className={`lp-wordmark lp-wordmark--${size}`} aria-label="MyMakanRoute home">
      My<span className="lp-wordmark__accent">Makan</span>Route
    </Link>
  );
}
