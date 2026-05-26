import { currency, getSnapshotChartPoints } from "@/lib/calculations";
import type { Snapshot } from "@/lib/mock-data";

type SeriesKey = "netWorth" | "invested" | "growth" | "model";

const series: Array<{ key: SeriesKey; label: string; color: string }> = [
  { key: "netWorth", label: "Net Worth", color: "#1d766f" },
  { key: "invested", label: "Invested", color: "#5572b8" },
  { key: "growth", label: "Growth", color: "#c25746" },
  { key: "model", label: "Model", color: "#887056" }
];

const ML = 72; // left margin for Y labels
const MR = 16;
const MT = 12;
const MB = 28; // bottom margin for X labels
const CW = 680; // chart width
const CH = 260; // chart height
const SW = ML + CW + MR;
const SH = MT + CH + MB;
const Y_TICKS = 5;

function formatYLabel(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `$${Math.round(value / 1_000)}k`;
  return `$${Math.round(value)}`;
}

function cx(index: number, total: number): number {
  return ML + (total === 1 ? CW / 2 : (index / (total - 1)) * CW);
}

function cy(value: number, min: number, max: number): number {
  const range = max - min || 1;
  return MT + CH - ((value - min) / range) * CH;
}

function polyPoints(values: number[], min: number, max: number): string {
  return values.map((v, i) => `${cx(i, values.length).toFixed(1)},${cy(v, min, max).toFixed(1)}`).join(" ");
}

type TrendChartProps = {
  snapshots?: Snapshot[];
};

export function TrendChart({ snapshots }: TrendChartProps) {
  const data = getSnapshotChartPoints(snapshots);
  if (data.length === 0) return null;

  const allValues = data.flatMap((point) => series.map((item) => point[item.key]));
  const rawMin = Math.min(...allValues);
  const rawMax = Math.max(...allValues);
  const min = rawMin * 0.92;
  const max = rawMax * 1.04;

  const yTicks = Array.from({ length: Y_TICKS }, (_, i) => {
    const value = min + ((max - min) / (Y_TICKS - 1)) * i;
    return { value, y: cy(value, min, max) };
  });

  // X labels: one per data point, skip alternates if crowded
  const skipEvery = data.length > 10 ? 2 : 1;

  return (
    <section className="panel chart-panel">
      <div className="section-heading">
        <div>
          <p>History</p>
          <h2>Net Worth Vs. Time</h2>
        </div>
      </div>
      <div className="chart-wrap">
        <svg viewBox={`0 0 ${SW} ${SH}`} role="img" aria-label="Snapshot trend chart">
          {/* Y gridlines + labels */}
          {yTicks.map(({ value, y }) => (
            <g key={value}>
              <line x1={ML} x2={ML + CW} y1={y.toFixed(1)} y2={y.toFixed(1)} className="chart-grid" />
              <text
                x={(ML - 8).toString()}
                y={y.toFixed(1)}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize="11"
                fill="#667169"
              >
                {formatYLabel(value)}
              </text>
            </g>
          ))}

          {/* X labels */}
          {data.map((point, i) => {
            if (i % skipEvery !== 0) return null;
            const x = cx(i, data.length);
            const year = new Date(point.date).getFullYear();
            return (
              <text
                key={i}
                x={x.toFixed(1)}
                y={(MT + CH + 18).toString()}
                textAnchor="middle"
                fontSize="11"
                fill="#667169"
              >
                {year}
              </text>
            );
          })}

          {/* Y axis line */}
          <line x1={ML} x2={ML} y1={MT} y2={MT + CH} stroke="#d9d5c8" strokeWidth="1" />

          {/* Series lines */}
          {series.map((item) => (
            <polyline
              key={item.key}
              fill="none"
              stroke={item.color}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={polyPoints(data.map((p) => p[item.key]), min, max)}
            />
          ))}

          {/* Data point dots for the latest value */}
          {series.map((item) => {
            const last = data[data.length - 1];
            const x = cx(data.length - 1, data.length);
            const y = cy(last[item.key], min, max);
            return <circle key={item.key} cx={x.toFixed(1)} cy={y.toFixed(1)} r="3.5" fill={item.color} />;
          })}
        </svg>
      </div>
      <div className="chart-footer">
        <div className="chart-legend">
          {series.map((item) => (
            <span key={item.key}>
              <i style={{ backgroundColor: item.color }} />
              {item.label}
            </span>
          ))}
        </div>
        <strong>{currency(data[data.length - 1].netWorth)}</strong>
      </div>
    </section>
  );
}
