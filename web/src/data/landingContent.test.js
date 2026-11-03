// Landing data checks: 4 places, correct labels, every image described and sized.
import { describe, expect, it } from "vitest";
import {
  FEATURED_PLACES,
  FOOTER,
  HERO,
  HOW_IT_WORKS,
  NAV_LINKS,
  PRICE_RANGES,
} from "./landingContent";

// Same Hidden Gem rule as the backend (default thresholds 4.3 and 100).
const expectedLabel = (p) => (p.rating >= 4.3 && p.reviewCount <= 100 ? "Hidden Gem" : "Popular");

describe("landingContent", () => {
  it("has 4 featured places: 3 Hidden Gems and 1 Popular", () => {
    expect(FEATURED_PLACES).toHaveLength(4);
    expect(FEATURED_PLACES.filter((p) => p.label === "Hidden Gem")).toHaveLength(3);
    expect(FEATURED_PLACES.filter((p) => p.label === "Popular")).toHaveLength(1);
  });

  it("features the four stalls that match the photos", () => {
    expect(FEATURED_PLACES.map((p) => p.name)).toEqual([
      "Rasheed Mee Goreng",
      "VR Pinxin Vegan",
      "He and She Coffee",
      "Ali Nasi Lemak Daun Pisang",
    ]);
    for (const place of FEATURED_PLACES) expect(place.description).toBeTruthy();
  });

  it("labels follow the Hidden Gem rule", () => {
    for (const place of FEATURED_PLACES) {
      expect(place.label).toBe(expectedLabel(place));
    }
  });

  it("every place has a known price range", () => {
    for (const place of FEATURED_PLACES) {
      expect(PRICE_RANGES[place.priceLevel]).toBeTruthy();
    }
  });

  it("every image has alt text, width and height", () => {
    const images = [HERO.image, ...FEATURED_PLACES.map((p) => p.image), ...HOW_IT_WORKS.images];
    for (const img of images) {
      expect(img.src).toBeTruthy();
      expect(img.alt.length).toBeGreaterThan(10);
      expect(img.width).toBeGreaterThan(0);
      expect(img.height).toBeGreaterThan(0);
    }
    for (const deco of HERO.decorations) {
      expect(deco.width).toBeGreaterThan(0);
      expect(deco.height).toBeGreaterThan(0);
    }
  });

  it("links point to the app pages and the About section", () => {
    expect(NAV_LINKS.map((l) => l.to ?? `#${l.anchor}`)).toEqual([
      "/",
      "/discover",
      "/trip",
      "/analytics",
      "#how-it-works",
    ]);
    expect(HERO.ctas.map((c) => c.to)).toEqual(["/trip", "/discover"]);
    expect(FOOTER.email).toBe("hello@mymakanroute.example");
  });
});
