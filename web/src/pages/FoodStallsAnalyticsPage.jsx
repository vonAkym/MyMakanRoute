// Food Stalls Analytics module page (/analytics), bento dashboard:
//   Food Places Visualisation -> KPI cards + charts (GET /api/analytics/overview)
//   Food Places Analysis      -> "Findings" sentences written by the backend
//   Food Place Suggestion     -> top hidden gems

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ReferenceArea,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { Gem, Lightbulb, Percent, Star, Store } from "lucide-react";
import { getAnalyticsOverview } from "../api/foodStallsAnalytics";
import ChartCard, { chartColour } from "../components/ChartCard";
import LabelBadge from "../components/LabelBadge";
import SampleDataBanner from "../components/SampleDataBanner";
import ErrorState from "../components/ErrorState";
import EmptyState from "../components/EmptyState";
import LoadingSkeleton from "../components/LoadingSkeleton";
import usePageTitle from "../hooks/usePageTitle";
import { capitalise, formatHalal, formatRating } from "../lib/format";
import "./FoodStallsAnalyticsPage.css";

const LABEL_COLOUR_TOKENS = {
  "Hidden Gem": "--chart-gem",
  Popular: "--chart-popular",
  "No label": "--chart-none",
};

const AXIS_TICK = { fontSize: 12, fill: chartColour("--color-muted-foreground") };
const MAX_BARS = 10; // keep bar charts readable; the data table has every row

function Kpi({ icon: Icon, label, value, hint }) {
  return (
    <div className="card kpi">
      <span className="kpi__icon" aria-hidden="true">
        <Icon size={20} />
      </span>
      <span className="kpi__label">{label}</span>
      <span className="kpi__value tabular">{value}</span>
      {hint && <span className="kpi__hint">{hint}</span>}
    </div>
  );
}

// Horizontal bars (names are long; horizontal fits phones better).
function RatingBarChart({ data, colour, grid }) {
  const rows = data.slice(0, MAX_BARS);
  return (
    <ResponsiveContainer width="100%" height={Math.max(180, rows.length * 34 + 50)}>
      <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 40, bottom: 20, left: 8 }}>
        <CartesianGrid horizontal={false} stroke={grid} />
        <XAxis
          type="number"
          domain={[0, 5]}
          ticks={[0, 1, 2, 3, 4, 5]}
          tick={AXIS_TICK}
          label={{
            value: "Average rating (out of 5)",
            position: "insideBottom",
            offset: -12,
            fontSize: 12,
          }}
        />
        <YAxis type="category" dataKey="label" width={110} tick={AXIS_TICK} interval={0} />
        <Tooltip
          formatter={(value, _name, item) => [
            `${Number(value).toFixed(2)} from ${item.payload.places} places`,
            "Average rating",
          ]}
        />
        <Bar
          dataKey="averageRating"
          name="Average rating"
          fill={colour}
          barSize={18}
          radius={[0, 4, 4, 0]}
          label={{ position: "right", fontSize: 12, formatter: (v) => Number(v).toFixed(1) }}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

export default function FoodStallsAnalyticsPage() {
  usePageTitle("Food stalls analytics");
  const [state, setState] = useState({ status: "loading", data: null, error: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    getAnalyticsOverview({ signal: controller.signal })
      .then((data) => setState({ status: "ready", data, error: null }))
      .catch((error) => {
        if (error.name !== "AbortError") setState({ status: "error", data: null, error });
      });
    return () => controller.abort();
  }, [attempt]);

  const colours = useMemo(
    () => ({
      gem: chartColour("--chart-gem"),
      popular: chartColour("--chart-popular"),
      none: chartColour("--chart-none"),
      bar: chartColour("--chart-bar"),
      grid: chartColour("--chart-grid"),
      surface: chartColour("--color-card"),
    }),
    [],
  );

  const data = state.data;

  const areaRows = useMemo(
    () => (data?.byArea ?? []).map((g) => ({ ...g, label: g.name })),
    [data],
  );
  const cuisineRows = useMemo(
    () => (data?.byCuisine ?? []).map((g) => ({ ...g, label: capitalise(g.name) })),
    [data],
  );
  // One scatter series per label so the legend names each colour.
  const scatterSeries = useMemo(() => {
    const groups = { "Hidden Gem": [], Popular: [], "No label": [] };
    (data?.points ?? []).forEach((p) => {
      // Log scale cannot show 0; such places are not labelled anyway.
      if (p.reviewCount > 0) groups[p.label ?? "No label"].push(p);
    });
    return groups;
  }, [data]);

  if (state.status === "loading") {
    return (
      <div className="container page">
        <header className="page-header">
          <span className="eyebrow">Food Stalls Analytics</span>
          <h1>Food stalls analytics</h1>
        </header>
        <LoadingSkeleton count={3} height={160} label="Loading analytics" />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="container page">
        <header className="page-header">
          <span className="eyebrow">Food Stalls Analytics</span>
          <h1>Food stalls analytics</h1>
        </header>
        <ErrorState
          title="Could not load analytics"
          error={state.error}
          onRetry={() => {
            setState({ status: "loading", data: null, error: null });
            setAttempt((a) => a + 1);
          }}
        />
      </div>
    );
  }

  const { totals, labels, findings, suggestions, thresholds } = data;

  return (
    <div className="container page">
      <header className="page-header">
        <span className="eyebrow">Food Stalls Analytics</span>
        <h1>Food stalls analytics</h1>
        <p>
          How rated food places in Penang compare by area, cuisine and label. Only places with a
          rating are counted.
        </p>
      </header>

      <SampleDataBanner note={data.note} />

      {totals.ratedPlaces === 0 ? (
        <EmptyState title="No rated places yet">
          <p>Load the sample data (npm run db:seed in the backend) to see the dashboard.</p>
        </EmptyState>
      ) : (
        <div className="bento">
          <div className="bento__kpis">
            <Kpi icon={Store} label="Rated places" value={totals.ratedPlaces} />
            <Kpi
              icon={Gem}
              label="Hidden gems"
              value={totals.hiddenGems}
              hint={`Rating ≥ ${thresholds.minRating}, ≤ ${thresholds.maxReviews} reviews`}
            />
            <Kpi
              icon={Star}
              label="Average rating"
              value={formatRating(totals.averageRating)}
              hint="out of 5"
            />
            <Kpi
              icon={Percent}
              label="Halal share"
              value={`${Math.round(totals.halalShare * 100)}%`}
              hint={`${totals.halalPlaces} of ${totals.ratedPlaces} places`}
            />
          </div>

          <section className="card bento__findings" aria-labelledby="findings-title">
            <h2 id="findings-title" className="findings__title">
              <Lightbulb size={20} aria-hidden="true" />
              Findings
            </h2>
            {findings.length > 0 ? (
              <ul className="findings__list">
                {findings.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            ) : (
              <p className="muted">Not enough data for findings yet.</p>
            )}
          </section>

          <ChartCard
            className="bento__area"
            title="Average rating by area"
            summary={
              areaRows[0]
                ? `${areaRows.length} areas. Highest: ${areaRows[0].name} (${formatRating(
                    areaRows[0].averageRating,
                  )} from ${areaRows[0].places} places).`
                : "No areas."
            }
            table={{
              columns: [
                { key: "name", label: "Area" },
                { key: "averageRating", label: "Average rating", format: (v) => formatRating(v) },
                { key: "places", label: "Rated places" },
              ],
              rows: areaRows,
            }}
          >
            <RatingBarChart data={areaRows} colour={colours.bar} grid={colours.grid} />
          </ChartCard>

          <ChartCard
            className="bento__cuisine"
            title="Average rating by cuisine"
            summary={
              cuisineRows.length > MAX_BARS
                ? `Top ${MAX_BARS} of ${cuisineRows.length} cuisines shown; the data table lists all.`
                : `${cuisineRows.length} cuisines.`
            }
            table={{
              columns: [
                { key: "label", label: "Cuisine" },
                { key: "averageRating", label: "Average rating", format: (v) => formatRating(v) },
                { key: "places", label: "Rated places" },
              ],
              rows: cuisineRows,
            }}
          >
            <RatingBarChart data={cuisineRows} colour={colours.bar} grid={colours.grid} />
          </ChartCard>

          <ChartCard
            className="bento__labels"
            title="Places by label"
            summary={labels.map((l) => `${l.label}: ${l.count}`).join(", ") + "."}
            table={{
              columns: [
                { key: "label", label: "Label" },
                { key: "count", label: "Places" },
              ],
              rows: labels,
            }}
          >
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={labels}
                  dataKey="count"
                  nameKey="label"
                  innerRadius="55%"
                  outerRadius="80%"
                  paddingAngle={1}
                  stroke={colours.surface}
                  strokeWidth={2}
                  label={({ value }) => value}
                  isAnimationActive={false}
                >
                  {labels.map((l) => (
                    <Cell key={l.label} fill={chartColour(LABEL_COLOUR_TOKENS[l.label])} />
                  ))}
                </Pie>
                <Tooltip formatter={(value, name) => [`${value} places`, name]} />
                <Legend verticalAlign="bottom" iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            className="bento__scatter"
            title="Rating vs number of reviews"
            summary={`Each dot is a place. The shaded box is the Hidden Gem zone: rating ${thresholds.minRating} or higher with ${thresholds.maxReviews} reviews or fewer. Reviews use a log scale.`}
            table={{
              columns: [
                { key: "name", label: "Place" },
                { key: "avgRating", label: "Rating", format: (v) => formatRating(v) },
                { key: "reviewCount", label: "Reviews" },
                { key: "label", label: "Label", format: (v) => v ?? "No label" },
              ],
              rows: data.points,
            }}
          >
            <ResponsiveContainer width="100%" height={320}>
              <ScatterChart margin={{ top: 8, right: 16, bottom: 28, left: 4 }}>
                <CartesianGrid stroke={colours.grid} />
                <XAxis
                  type="number"
                  dataKey="reviewCount"
                  name="Reviews"
                  scale="log"
                  domain={[1, "auto"]}
                  allowDataOverflow
                  tick={AXIS_TICK}
                  label={{
                    value: "Number of reviews (log scale)",
                    position: "insideBottom",
                    offset: -16,
                    fontSize: 12,
                  }}
                />
                <YAxis
                  type="number"
                  dataKey="avgRating"
                  name="Rating"
                  domain={[3, 5]}
                  tick={AXIS_TICK}
                  width={44}
                  label={{ value: "Rating", angle: -90, position: "insideLeft", fontSize: 12 }}
                />
                <ZAxis range={[80, 80]} />
                <ReferenceArea
                  x1={1}
                  x2={thresholds.maxReviews}
                  y1={thresholds.minRating}
                  y2={5}
                  fill={colours.gem}
                  fillOpacity={0.1}
                  stroke={colours.gem}
                  strokeDasharray="4 4"
                  label={{ value: "Hidden Gem zone", position: "insideTopLeft", fontSize: 12 }}
                />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  content={({ active, payload }) => {
                    const p = active && payload?.[0]?.payload;
                    if (!p) return null;
                    return (
                      <div className="chart-tooltip">
                        <strong>{p.name}</strong>
                        <span>
                          {formatRating(p.avgRating)} from {p.reviewCount} reviews
                        </span>
                        <span>{p.label ?? "No label"}</span>
                      </div>
                    );
                  }}
                />
                <Legend verticalAlign="top" iconType="circle" height={28} />
                <Scatter
                  name="Hidden Gem"
                  data={scatterSeries["Hidden Gem"]}
                  fill={colours.gem}
                  stroke={colours.surface}
                  strokeWidth={2}
                />
                <Scatter
                  name="Popular"
                  data={scatterSeries.Popular}
                  fill={colours.popular}
                  stroke={colours.surface}
                  strokeWidth={2}
                />
                <Scatter
                  name="No label"
                  data={scatterSeries["No label"]}
                  fill={colours.none}
                  stroke={colours.surface}
                  strokeWidth={2}
                />
              </ScatterChart>
            </ResponsiveContainer>
          </ChartCard>

          <section className="card bento__suggestions" aria-labelledby="suggest-title">
            <h2 id="suggest-title">Suggested hidden gems</h2>
            <p className="muted small">
              Best rated hidden gems; with equal ratings, the less known one first.
            </p>
            {suggestions.length === 0 ? (
              <p className="muted">No hidden gems yet.</p>
            ) : (
              <ol className="suggestions">
                {suggestions.map((s) => (
                  <li key={s.id} className="suggestion">
                    <div>
                      <strong className="suggestion__name">{s.name}</strong>
                      <span className="muted small">
                        {capitalise(s.cuisine)} · {s.area} · {formatHalal(s.isHalal)}
                      </span>
                    </div>
                    <div className="suggestion__right">
                      <span className="tabular">
                        <Star size={14} aria-hidden="true" className="suggestion__star" />
                        {formatRating(s.avgRating)} ({s.reviewCount})
                      </span>
                      <LabelBadge label={s.label} size="sm" />
                    </div>
                  </li>
                ))}
              </ol>
            )}
            <Link
              to="/discover"
              className="btn btn-secondary btn-sm"
              style={{ marginTop: "var(--space-md)" }}
            >
              Find more on Discover
            </Link>
          </section>
        </div>
      )}
    </div>
  );
}
