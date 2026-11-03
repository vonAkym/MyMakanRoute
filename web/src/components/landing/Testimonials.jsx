// "What Food Hoppers Say": SAMPLE reviews in a carousel (a row of cards that slides).
// 3 cards on desktop, 2 on tablets, 1 on phones; moves one card per step; no autoplay.
// Controls: arrows, dots, Left/Right keys when the carousel has focus, and a 50px+ swipe.

import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Quote, Star } from "lucide-react";
import { TESTIMONIALS } from "../../data/landingContent";
import useMediaQuery from "../../hooks/useMediaQuery";
import useRevealOnScroll from "../../hooks/useRevealOnScroll";
import SectionHeading from "./SectionHeading";
import "./Testimonials.css";

const SWIPE_MIN_PX = 50;

// "Aisyah Rahman" -> "AR"
function initials(name) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

// Average of the sample ratings, rounded to 1 decimal (e.g. 4.8).
export function averageRating(items) {
  if (items.length === 0) return 0;
  const sum = items.reduce((total, item) => total + item.rating, 0);
  return Math.round((sum / items.length) * 10) / 10;
}

// "Review 2 of 6" (one card visible) or "Reviews 2–4 of 6" (several visible).
export function positionText(first, perView, total) {
  const last = Math.min(first + perView, total);
  return last - first > 1
    ? `Reviews ${first + 1}–${last} of ${total}`
    : `Review ${first + 1} of ${total}`;
}

function Stars({ value, size = 16 }) {
  return (
    <span className="lp-stars" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={size} fill={n <= Math.round(value) ? "currentColor" : "none"} />
      ))}
    </span>
  );
}

export default function Testimonials({ content = TESTIMONIALS }) {
  const revealRef = useRevealOnScroll();
  const wide = useMediaQuery("(min-width: 1024px)");
  const medium = useMediaQuery("(min-width: 640px)");
  const perView = wide ? 3 : medium ? 2 : 1;

  const items = content.items;
  const maxIndex = Math.max(0, items.length - perView);
  const [index, setIndex] = useState(0);
  const [announcement, setAnnouncement] = useState("");
  const [prevMaxIndex, setPrevMaxIndex] = useState(maxIndex);
  const swipeStart = useRef(null);
  const average = averageRating(items);

  // Screen size changed (e.g. phone turned sideways): keep the index in range.
  // (React's "adjust state while rendering" pattern, no effect needed.)
  if (prevMaxIndex !== maxIndex) {
    setPrevMaxIndex(maxIndex);
    if (index > maxIndex) setIndex(maxIndex);
  }
  const current = Math.min(index, maxIndex);
  const atStart = current === 0;
  const atEnd = current === maxIndex;

  function go(next) {
    const clamped = Math.max(0, Math.min(next, maxIndex));
    if (clamped === current) return; // already at the end: nothing to do
    setIndex(clamped);
    setAnnouncement(positionText(clamped, perView, items.length));
  }

  function onKeyDown(e) {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      go(current - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      go(current + 1);
    }
  }

  // Touch/pen swipe: a mostly horizontal move of at least 50px.
  function onPointerDown(e) {
    if (e.pointerType === "mouse") return;
    swipeStart.current = { x: e.clientX, y: e.clientY };
  }
  function onPointerUp(e) {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.abs(dx) >= SWIPE_MIN_PX && Math.abs(dx) > Math.abs(dy)) {
      go(dx < 0 ? current + 1 : current - 1);
    }
  }

  return (
    <section className="lp-section" aria-labelledby="lp-reviews-title">
      <div ref={revealRef} className="lp-container lp-reveal">
        <SectionHeading
          id="lp-reviews-title"
          eyebrow={content.eyebrow}
          title={content.title}
          highlight={content.highlight}
        />
        <div className="lp-reviews__summary">
          <span className="lp-reviews__average">{average.toFixed(1)}</span>
          <Stars value={average} size={20} />
          <span className="visually-hidden">out of 5 average rating</span>
          <span className="lp-reviews__sample">Sample</span>
          <span className="lp-reviews__note">{content.note}</span>
        </div>

        <div
          className="lp-carousel"
          role="region"
          aria-roledescription="carousel"
          aria-label="Food hopper reviews"
          tabIndex={0}
          onKeyDown={onKeyDown}
        >
          <div
            className="lp-carousel__viewport"
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onPointerCancel={() => (swipeStart.current = null)}
          >
            <ul
              className="lp-carousel__track"
              style={{
                "--per-view": perView,
                transform: `translateX(-${(current * 100) / perView}%)`,
              }}
            >
              {items.map((item, i) => {
                const visible = i >= current && i < current + perView;
                return (
                  <li
                    key={item.id}
                    className="lp-carousel__slide"
                    role="group"
                    aria-roledescription="slide"
                    aria-label={`Review ${i + 1} of ${items.length}`}
                    aria-hidden={!visible}
                  >
                    <figure className="lp-review">
                      <Quote className="lp-review__quote-icon" size={28} aria-hidden="true" />
                      <Stars value={item.rating} />
                      <span className="visually-hidden">{item.rating} out of 5 stars</span>
                      <blockquote className="lp-review__quote">
                        <p>{item.quote}</p>
                      </blockquote>
                      <figcaption className="lp-review__person">
                        <span className="lp-review__avatar" aria-hidden="true">
                          {initials(item.name)}
                        </span>
                        <span>
                          <strong className="lp-review__name">{item.name}</strong>
                          <span className="lp-review__role">{item.role}</span>
                        </span>
                      </figcaption>
                    </figure>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="lp-carousel__controls">
            <button
              type="button"
              className="lp-carousel__arrow"
              aria-label="Previous review"
              aria-disabled={atStart ? "true" : undefined}
              onClick={() => go(current - 1)}
            >
              <ChevronLeft size={22} aria-hidden="true" />
            </button>
            <div className="lp-carousel__dots">
              {Array.from({ length: maxIndex + 1 }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  className="lp-carousel__dot"
                  aria-label={`Go to review ${i + 1}`}
                  aria-current={i === current ? "true" : undefined}
                  onClick={() => go(i)}
                />
              ))}
            </div>
            <button
              type="button"
              className="lp-carousel__arrow"
              aria-label="Next review"
              aria-disabled={atEnd ? "true" : undefined}
              onClick={() => go(current + 1)}
            >
              <ChevronRight size={22} aria-hidden="true" />
            </button>
          </div>

          {/* Polite live region: screen readers hear the new position after a change. */}
          <p className="visually-hidden" aria-live="polite" aria-atomic="true">
            {announcement}
          </p>
        </div>
      </div>
    </section>
  );
}
