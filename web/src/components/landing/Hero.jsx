// Landing hero: text, two buttons and feature badges on the left; a big round plate
// photo (cropped to a circle) with an "Est. 2026" badge and floating chilli/leaf/star anise on the right.
// On phones and tablets it stacks: text first, then the plate.

import { HERO } from "../../data/landingContent";
import Button from "./Button";
import FeatureBadges from "./FeatureBadges";
import "./Hero.css";

export default function Hero({ content = HERO }) {
  const { eyebrow, title, highlight, text, ctas, image, badge, decorations } = content;
  return (
    <section className="lp-hero" aria-labelledby="lp-hero-title">
      <div className="lp-hero__inner">
        <div className="lp-hero__text">
          <p className="lp-eyebrow">{eyebrow}</p>
          <h1 id="lp-hero-title" className="lp-hero__title">
            {title}
            <span className="lp-highlight">{highlight}</span>
          </h1>
          <p className="lp-hero__lead">{text}</p>
          <div className="lp-hero__ctas">
            {ctas.map((cta) => (
              <Button key={cta.label} to={cta.to} variant={cta.variant}>
                {cta.label}
              </Button>
            ))}
          </div>
          <FeatureBadges />
        </div>

        <div className="lp-hero__art">
          <div className="lp-hero__plate-wrap">
            {/* The hero image loads first (no lazy loading): it is the main picture. */}
            <img
              className="lp-hero__plate"
              src={image.src}
              alt={image.alt}
              width={image.width}
              height={image.height}
              style={{ objectPosition: image.position }}
              fetchPriority="high"
            />
            <p className="lp-hero__badge">
              <span className="lp-hero__badge-top">{badge.top}</span>
              <span className="lp-hero__badge-year">{badge.bottom}</span>
            </p>
            {decorations.map((d) => (
              <img
                key={d.id}
                className={`lp-hero__deco lp-hero__deco--${d.id}`}
                src={d.src}
                alt=""
                width={d.width}
                height={d.height}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
