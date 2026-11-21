// Scrolls to a section of the landing page (used by the About link).
// Smooth only when the user allows motion; otherwise an instant jump.
// Focus moves to the section so keyboard and screen reader users land there too.

export default function scrollToSection(id, reducedMotion) {
  const section = document.getElementById(id);
  if (!section) return false;
  if (typeof section.scrollIntoView === "function") {
    section.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
  }
  section.focus({ preventScroll: true });
  return true;
}
