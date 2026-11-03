// "Hidden Gems Near You": the featured place cards (4 / 2 / 1 per row) and a button to
// Discover. The places are SAMPLE data (see data/landingContent.js).

import { FEATURED_PLACES, PLACES_SECTION } from "../../data/landingContent";
import useRevealOnScroll from "../../hooks/useRevealOnScroll";
import Button from "./Button";
import PlaceCard from "./PlaceCard";
import SectionHeading from "./SectionHeading";
import "./PlaceGrid.css";

export default function PlaceGrid({ places = FEATURED_PLACES, content = PLACES_SECTION }) {
  const revealRef = useRevealOnScroll();
  return (
    <section className="lp-section" aria-labelledby="lp-places-title">
      <div ref={revealRef} className="lp-container lp-reveal">
        <SectionHeading
          id="lp-places-title"
          eyebrow={content.eyebrow}
          title={content.title}
          highlight={content.highlight}
          after={content.after}
          text={content.text}
        />
        <ul className="lp-places">
          {places.map((place) => (
            <li key={place.id}>
              <PlaceCard place={place} />
            </li>
          ))}
        </ul>
        <div className="lp-places__more">
          <Button to={content.cta.to} variant="outline">
            {content.cta.label}
          </Button>
          <p className="lp-places__note">
            {content.note} {content.photoNote}
          </p>
        </div>
      </div>
    </section>
  );
}
