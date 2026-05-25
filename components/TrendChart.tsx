import { currency, getSnapshotChartPoints } from "@/lib/calculations";
import type { Snapshot } from "@/lib/mock-data";

type SeriesKey = "netWorth" | "invested" | "growth" | "model";

const series: Array<{ key: SeriesKey; label: string; color: string }> = [
  { key: "netWorth", label: "Net Worth", color: "#1d766f" },
  { key: "invested", label: "Invested", color: "#5572b8" },
  { key: "growth", label: "Growth", color: "#c25746" },
  { key: "model", label: "Model", color: "#887056" }
];

function pointsFor(values: number[], width: number, height: number, min: number, max: number) {
  const range = max - min || 1;
  return values
    .map((value, index) => {
      const x = values.length === 1 ? width : (index / (values.length - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");
}

type TrendChartProps = {
  snapshots?: Snapshot[];
};

export function TrendChart({ snapshots }: TrendChartProps) {
  const data = getSnapshotChartPoints(snapshots);
  const width = 720;
  const height = 280;
  const allValues = data.flatMap((point) => series.map((item) => point[item.key]));
  const min = Math.min(...allValues) * 0.92;
  const max = Math.max(...allValues) * 1.04;

  return (
    <section className="panel chart-panel">
      <div className="section-heading">
        <div>
          <p>History</p>
          <h2>Net Worth Vs. Time</h2>
        </div>
      </div>
      <div className="chart-wrap">
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Snapshot trend chart">
          {[0, 1, 2, 3].map((line) => (
            <line
              key={line}
              x1="0"
              x2={width}
              y1={(height / 3) * line}
              y2={(height / 3) * line}
              className="chart-grid"
            />
          ))}
          {series.map((item) => (
            <polyline
              key={item.key}
              fill="none"
              stroke={item.color}
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={pointsFor(
                data.map((point) => point[item.key]),
                width,
                height,
                min,
                max
              )}
            />
          ))}
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
