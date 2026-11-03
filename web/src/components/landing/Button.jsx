// Landing page button. One look for links and buttons:
//   variant="filled"  orange fill, dark text (7.1:1)
//   variant="outline" thin orange outline; fills orange with dark text on hover
// Renders a router <Link> when `to` is given, an <a> for `href`, else a <button>.

import { Link } from "react-router-dom";
import "./Button.css";

export default function Button({
  variant = "filled",
  to,
  href,
  className = "",
  children,
  ...rest
}) {
  const classes = `lp-btn lp-btn--${variant} ${className}`.trim();
  if (to) {
    return (
      <Link to={to} className={classes} {...rest}>
        {children}
      </Link>
    );
  }
  if (href) {
    return (
      <a href={href} className={classes} {...rest}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" className={classes} {...rest}>
      {children}
    </button>
  );
}
