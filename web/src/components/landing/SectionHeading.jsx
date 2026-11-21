// Landing section heading: small uppercase orange eyebrow with a short line beside it,
// a bold white title with ONE orange key word, an optional thin divider and paragraph.
// The title is built as: title + <highlight> + after, e.g. "Plan Every " + "Bite".

import "./SectionHeading.css";

export default function SectionHeading({
  eyebrow,
  title = "",
  highlight,
  after = "",
  text,
  as: Tag = "h2",
  id,
  align = "center",
  divider = align === "center",
}) {
  return (
    <div className={`lp-heading lp-heading--${align}`}>
      {eyebrow && <p className="lp-eyebrow">{eyebrow}</p>}
      <Tag id={id} className="lp-heading__title">
        {title}
        {highlight && <span className="lp-highlight">{highlight}</span>}
        {after}
      </Tag>
      {divider && (
        <span className="lp-divider" aria-hidden="true">
          <span className="lp-divider__dot" />
        </span>
      )}
      {text && <p className="lp-heading__text">{text}</p>}
    </div>
  );
}
