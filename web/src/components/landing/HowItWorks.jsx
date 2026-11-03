// "How it works" (also the About target, id="how-it-works"): heading, short text, three
// stats and a picture collage, then the three steps Discover, Plan the route, Review.

import { HOW_IT_WORKS } from "../../data/landingContent";
import useRevealOnScroll from "../../hooks/useRevealOnScroll";
import SectionHeading from "./SectionHeading";
import "./HowItWorks.css";

export default function HowItWorks({ content = HOW_IT_WORKS }) {
  const topRef = useRevealOnScroll();
  const stepsRef = useRevealOnScroll();
  const [big, ...small] = content.images;

  return (
    <section
      id="how-it-works"
      className="lp-section lp-section--alt"
      aria-labelledby="lp-how-title"
      tabIndex={-1}
    >
      <div className="lp-container">
        <div ref={topRef} className="lp-how lp-reveal">
          <div className="lp-how__collage">
            <img
              className="lp-how__img lp-how__img--big"
              src={big.src}
              alt={big.alt}
              width={big.width}
              height={big.height}
              loading="lazy"
              decoding="async"
            />
            {small.map((img) => (
              <img
                key={img.src}
                className="lp-how__img"
                src={img.src}
                alt={img.alt}
                width={img.width}
                height={img.height}
                loading="lazy"
                decoding="async"
              />
            ))}
          </div>

          <div className="lp-how__text">
            <SectionHeading
              id="lp-how-title"
              align="left"
              eyebrow={content.eyebrow}
              title={content.title}
              highlight={content.highlight}
              text={content.text}
            />
            <dl className="lp-stats">
              {content.stats.map((stat) => (
                <div key={stat.label} className="lp-stats__item">
                  <dt className="lp-stats__label">{stat.label}</dt>
                  <dd className="lp-stats__value">{stat.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        <ol ref={stepsRef} className="lp-steps lp-reveal">
          {content.steps.map(({ icon: Icon, title, text }, i) => (
            <li key={title} className="lp-step">
              <span className="lp-step__number" aria-hidden="true">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="lp-step__icon" aria-hidden="true">
                <Icon size={24} />
              </span>
              <h3 className="lp-step__title">{title}</h3>
              <p className="lp-step__text">{text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
