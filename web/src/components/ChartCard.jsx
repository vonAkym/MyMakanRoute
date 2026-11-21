// Food Places Visualisation: a titled card around one chart, with a text summary for
// screen readers and a "Show data table" toggle (charts alone are not accessible).

import { useId, useState } from "react";
import { Table2 } from "lucide-react";

// Chart colours come from the CSS tokens (Recharts needs real colour values, and SVG
// attributes do not reliably resolve var()). The fallbacks equal tokens.css.
const FALLBACK = {
  "--chart-gem": "#ea580c",
  "--chart-popular": "#0891b2",
  "--chart-none": "#a8a29e",
  "--chart-bar": "#475569",
  "--chart-grid": "#e2e8f0",
  "--color-card": "#ffffff",
  "--color-muted-foreground": "#475569",
};

export function chartColour(name) {
  if (typeof window === "undefined") return FALLBACK[name];
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || FALLBACK[name];
}

// columns: [{ key, label, format? }]; rows: array of objects.
function DataTable({ caption, columns, rows }) {
  return (
    <div className="data-table-wrap">
      <table className="data-table">
        <caption className="visually-hidden">{caption}</caption>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.id ?? row.name ?? i}>
              {columns.map((c, j) =>
                j === 0 ? (
                  <th key={c.key} scope="row">
                    {c.format ? c.format(row[c.key], row) : row[c.key]}
                  </th>
                ) : (
                  <td key={c.key} className="tabular">
                    {c.format ? c.format(row[c.key], row) : row[c.key]}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ChartCard({ title, summary, className = "", table, children }) {
  const [showTable, setShowTable] = useState(false);
  const id = useId();
  return (
    <section className={`card chart-card ${className}`} aria-labelledby={`${id}-title`}>
      <div className="chart-card__head">
        <h2 id={`${id}-title`} className="chart-card__title">
          {title}
        </h2>
        {table && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            aria-pressed={showTable}
            onClick={() => setShowTable((s) => !s)}
          >
            <Table2 size={16} aria-hidden="true" />
            {showTable ? "Show chart" : "Show data table"}
          </button>
        )}
      </div>
      {summary && <p className="chart-card__summary">{summary}</p>}
      {showTable && table ? (
        <DataTable caption={title} columns={table.columns} rows={table.rows} />
      ) : (
        <div className="chart-card__chart" aria-hidden="true">
          {children}
        </div>
      )}
    </section>
  );
}
