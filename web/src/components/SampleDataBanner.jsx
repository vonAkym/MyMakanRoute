// Shown whenever the API says the answer includes SAMPLE data (invented ratings).

import { FlaskConical } from "lucide-react";

export default function SampleDataBanner({ note }) {
  if (!note) return null;
  return (
    <div className="notice" role="note">
      <FlaskConical size={18} aria-hidden="true" />
      <p style={{ margin: 0 }}>
        <strong>Sample data:</strong> {note}
      </p>
    </div>
  );
}
