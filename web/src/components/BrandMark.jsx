// Original MyMakanRoute monogram: a thin circle with a geometric "M" whose middle dips
// like a route between two stops. Uses currentColor, so it follows the text colour.

export default function BrandMark({ size = 32 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="16" cy="16" r="15" />
      <path d="M9.5 22V10.5l6.5 8 6.5-8V22" />
      <circle cx="16" cy="18.5" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}
