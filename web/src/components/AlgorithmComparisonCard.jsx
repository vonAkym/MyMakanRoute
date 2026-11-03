// Route Planner: compares Ant Colony Optimisation (ACO) with nearest neighbour and
// brute force for the same stops. This is the Intelligent Computing showcase.

import { BrainCircuit, CheckCircle2, Info } from "lucide-react";
import { toMinutes } from "../lib/format";
import "./AlgorithmComparisonCard.css";

// Two totals count as equal when they differ by less than a second (rounding).
const SAME_SECONDS = 1;

function comparisonSentence(aco, nn, brute) {
  const sentences = [];
  if (brute) {
    const gap = aco.totalTimeS - brute.totalTimeS;
    sentences.push(
      gap < SAME_SECONDS
        ? "ACO matched the optimal order found by brute force."
        : `ACO was ${toMinutes(gap)} min slower than the optimal order.`,
    );
  } else {
    sentences.push("Brute force was skipped: it only runs for up to 8 stops.");
  }
  if (nn) {
    const saved = nn.totalTimeS - aco.totalTimeS;
    sentences.push(
      saved >= SAME_SECONDS
        ? `ACO saved ${toMinutes(saved)} min compared with nearest neighbour.`
        : "Nearest neighbour found an equally short order here.",
    );
  }
  return sentences;
}

export default function AlgorithmComparisonCard({ comparison, algorithm, graph }) {
  const { aco, nearestNeighbour: nn, bruteForce: brute } = comparison ?? {};
  if (!aco) return null;

  const rows = [
    {
      key: "aco",
      name: "Ant Colony Optimisation (used)",
      result: aco,
      hint: "Many virtual ants try orders and leave 'pheromone' on short ones.",
    },
    {
      key: "nn",
      name: "Nearest neighbour",
      result: nn,
      hint: "Always walk to the closest stop not visited yet.",
    },
    {
      key: "brute",
      name: "Brute force (optimal)",
      result: brute,
      hint: "Tries every possible order. Exact, but slow for many stops.",
    },
  ];
  const longest = Math.max(...rows.filter((r) => r.result).map((r) => r.result.totalTimeS), 1);
  const sentences = comparisonSentence(aco, nn, brute);
  const matched = brute && aco.totalTimeS - brute.totalTimeS < SAME_SECONDS;

  return (
    <section className="card algo-card" aria-labelledby="algo-title">
      <h2 id="algo-title" className="algo-card__title">
        <BrainCircuit size={20} aria-hidden="true" />
        Algorithm comparison
      </h2>
      <p className="muted small">
        Total travel time of the visiting order each method found (same stops, same start).
      </p>

      <table className="algo-table">
        <caption className="visually-hidden">Total travel time per algorithm</caption>
        <thead>
          <tr>
            <th scope="col">Method</th>
            <th scope="col">Total time</th>
            <th scope="col" className="algo-table__bar-col">
              <span className="visually-hidden">Bar</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className={row.key === "aco" ? "is-aco" : undefined}>
              <th scope="row">
                <span className="algo-table__name">{row.name}</span>
                <span className="algo-table__hint">{row.hint}</span>
              </th>
              <td className="tabular algo-table__value">
                {row.result ? `${toMinutes(row.result.totalTimeS)} min` : "Skipped"}
              </td>
              <td className="algo-table__bar-col" aria-hidden="true">
                {row.result && (
                  <span
                    className={`algo-bar algo-bar--${row.key}`}
                    style={{ width: `${(row.result.totalTimeS / longest) * 100}%` }}
                  />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className={`notice${matched ? " notice-success" : ""}`} role="status">
        {matched ? (
          <CheckCircle2 size={18} aria-hidden="true" />
        ) : (
          <Info size={18} aria-hidden="true" />
        )}
        <p style={{ margin: 0 }}>{sentences.join(" ")}</p>
      </div>

      {algorithm && (
        <details className="algo-details">
          <summary>ACO settings and road graph</summary>
          <dl className="algo-details__list tabular">
            <dt>Ants</dt>
            <dd>{algorithm.ants}</dd>
            <dt>Iterations</dt>
            <dd>
              {algorithm.iterationsRun ?? algorithm.iterations} run (max {algorithm.iterations}),
              best found at {algorithm.bestFoundAtIteration ?? "?"}
            </dd>
            <dt>Alpha / beta</dt>
            <dd>
              {algorithm.alpha} / {algorithm.beta}
            </dd>
            <dt>Evaporation</dt>
            <dd>{algorithm.evaporation}</dd>
            <dt>Random seed</dt>
            <dd>{algorithm.seed}</dd>
            {aco.runtimeMs != null && (
              <>
                <dt>ACO run time</dt>
                <dd>{aco.runtimeMs} ms</dd>
              </>
            )}
            {graph && (
              <>
                <dt>Road graph</dt>
                <dd>
                  {graph.source}: {graph.nodes?.toLocaleString()} nodes,{" "}
                  {graph.edges?.toLocaleString()} edges (Dijkstra travel times)
                </dd>
              </>
            )}
          </dl>
        </details>
      )}
    </section>
  );
}
