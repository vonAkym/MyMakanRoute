// Row of three small feature badges under the hero buttons (icon + title + short line).

import { FEATURE_BADGES } from "../../data/landingContent";

export default function FeatureBadges({ items = FEATURE_BADGES }) {
  return (
    <ul className="lp-badges" aria-label="Features">
      {items.map(({ icon: Icon, title, text }) => (
        <li key={title} className="lp-badges__item">
          <span className="lp-badges__icon" aria-hidden="true">
            <Icon size={20} />
          </span>
          <span>
            <strong className="lp-badges__title">{title}</strong>
            <span className="lp-badges__text">{text}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
