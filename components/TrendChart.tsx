"use client";

import { useRef, useState, type CSSProperties } from "react";
import { currency, dateLabel, getExponentialFit, getSnapshotChartPoints } from "@/lib/calculations";
import type { Snapshot } from "@/lib/mock-data";

type SeriesKey = "netWorth" | "invested" | "growth";

const dataSeries: Array<{ key: SeriesKey; label: string; color: string }> = [
  { key: "netWorth", label: "Net Worth", color: "#1a1a1a" },
  { key: "invested", label: "Invested", color: "#5572b8" },
  { key: "growth", label: "Growth", color: "#2d8a4e" }
];

const ML = 72;
const MR = 16;
const MT = 12;
const MB = 28;
const CW = 680;
const CH = 260;
const SW = ML + CW + MR;
const SH = MT + CH + MB;
const Y_TICKS = 5;
const MODEL_SAMPLES = 200;
const MS_PER_YEAR = 1000 * 60 * 60 * 24 * 365.25;

function formatYLabel(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `$${Math.round(value / 1_000)}k`;
  return `$${Math.round(value)}`;
}

function cxMs(ms: number, minMs: number, maxMs: number): number {
  return ML + ((ms - minMs) / (maxMs - minMs || 1)) * CW;
}

function cy(value: number, min: number, max: number): number {
  const range = max - min || 1;
  return MT + CH - ((value - min) / range) * CH;
}

type TrendChartProps = {
  snapshots?: Snapshot[];
};

type HoveredPoint = {
  point: ReturnType<typeof getSnapshotChartPoints>[0];
  svgX: number;
  svgY: number; // cursor Y in viewBox units, clamped to the plot area
  cssXFraction: number; // 0–1 across chart width, for tooltip flip logic
};

export function TrendChart({ snapshots }: TrendChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hovered, setHovered] = useState<HoveredPoint | null>(null);

  const data = getSnapshotChartPoints(snapshots);
  const fit = getExponentialFit(snapshots);
  if (data.length === 0) return null;

  const minMs = new Date(data[0].date).getTime();
  const maxMs = new Date(data[data.length - 1].date).getTime();

  const dataValues = data.flatMap((p) => dataSeries.map((s) => p[s.key]));
  const modelValues = fit
    ? Array.from({ length: MODEL_SAMPLES }, (_, i) => {
        const ms = minMs + (i / (MODEL_SAMPLES - 1)) * (maxMs - minMs);
        const t = (ms - fit.t0Ms) / MS_PER_YEAR;
        return fit.a * Math.exp(fit.b * t);
      }).filter((v) => isFinite(v) && v > 0)
    : [];
  const allValues = [...dataValues, ...modelValues];
  const rawMin = Math.min(...allValues);
  const rawMax = Math.max(...allValues);
  const range = rawMax - rawMin || rawMax;
  const min = Math.max(0, rawMin - range * 0.06);
  const max = rawMax + range * 0.04;

  const yTicks = Array.from({ length: Y_TICKS }, (_, i) => {
    const value = min + ((max - min) / (Y_TICKS - 1)) * i;
    return { value, y: cy(value, min, max) };
  });

  const startYear = new Date(minMs).getFullYear();
  const endYear = new Date(maxMs).getFullYear();
  const xYears = Array.from({ length: endYear - startYear + 1 }, (_, i) => startYear + i);

  const modelPolyPoints = fit
    ? Array.from({ length: MODEL_SAMPLES }, (_, i) => {
        const ms = minMs + (i / (MODEL_SAMPLES - 1)) * (maxMs - minMs);
        const t = (ms - fit.t0Ms) / MS_PER_YEAR;
        const y = fit.a * Math.exp(fit.b * t);
        const x = cxMs(ms, minMs, maxMs);
        return `${x.toFixed(1)},${cy(y, min, max).toFixed(1)}`;
      }).join(" ")
    : null;

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * SW;
    if (relX < ML || relX > ML + CW) {
      setHovered(null);
      return;
    }
    const ms = minMs + ((relX - ML) / CW) * (maxMs - minMs);
    let nearest = data[0];
    let nearestDist = Infinity;
    for (const p of data) {
      const dist = Math.abs(new Date(p.date).getTime() - ms);
      if (dist < nearestDist) { nearestDist = dist; nearest = p; }
    }
    const pointMs = new Date(nearest.date).getTime();
    const svgX = cxMs(pointMs, minMs, maxMs);
    const cssXFraction = (svgX - ML) / CW;
    const relY = ((e.clientY - rect.top) / rect.height) * SH;
    const svgY = Math.max(MT, Math.min(MT + CH, relY));
    setHovered({ point: nearest, svgX, svgY, cssXFraction });
  }

  // Anchor the tooltip beside the data dot vertically closest to the cursor,
  // expanding into whichever side (down/up) has more room so it stays in bounds.
  let tooltipVStyle: CSSProperties = { top: 12 };
  if (hovered) {
    let anchorY = cy(hovered.point[dataSeries[0].key], min, max);
    let best = Infinity;
    for (const item of dataSeries) {
      const y = cy(hovered.point[item.key], min, max);
      const dist = Math.abs(y - hovered.svgY);
      if (dist < best) { best = dist; anchorY = y; }
    }
    const expandUp = anchorY > MT + CH / 2;
    tooltipVStyle = expandUp
      ? { top: "auto", bottom: `calc(${((SH - anchorY) / SH) * 100}% + 8px)` }
      : { top: `calc(${(anchorY / SH) * 100}% + 8px)` };
  }

  return (
    <section className="panel chart-panel">
      <div className="section-heading">
        <div>
          <p>History</p>
          <h2>Net Worth Vs. Time</h2>
        </div>
      </div>
      <div className="chart-wrap" style={{ position: "relative" }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${SW} ${SH}`}
          role="img"
          aria-label="Snapshot trend chart"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHovered(null)}
          style={{ cursor: "crosshair", display: "block" }}
        >
          {yTicks.map(({ value, y }) => (
            <g key={value}>
              <line x1={ML} x2={ML + CW} y1={y.toFixed(1)} y2={y.toFixed(1)} className="chart-grid" />
              <text x={(ML - 8).toString()} y={y.toFixed(1)} textAnchor="end" dominantBaseline="middle" fontSize="11" fill="#667169">
                {formatYLabel(value)}
              </text>
            </g>
          ))}

          {xYears.map((year) => {
            const ms = new Date(`${year}-01-01`).getTime();
            if (ms < minMs || ms > maxMs) return null;
            const x = cxMs(ms, minMs, maxMs);
            return (
              <text key={year} x={x.toFixed(1)} y={(MT + CH + 18).toString()} textAnchor="middle" fontSize="11" fill="#667169">
                {year}
              </text>
            );
          })}

          <line x1={ML} x2={ML} y1={MT} y2={MT + CH} stroke="#d9d5c8" strokeWidth="1" />

          {modelPolyPoints && (
            <polyline fill="none" stroke="#b0b0b0" strokeWidth="1.5" strokeDasharray="5 3" strokeLinecap="round" strokeLinejoin="round" points={modelPolyPoints} />
          )}

          {dataSeries.map((item) => {
            const points = data.map((p) => {
              const x = cxMs(new Date(p.date).getTime(), minMs, maxMs);
              const y = cy(p[item.key], min, max);
              return `${x.toFixed(1)},${y.toFixed(1)}`;
            }).join(" ");
            return (
              <polyline key={item.key} fill="none" stroke={item.color} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" points={points} />
            );
          })}

          {/* End-of-series dots */}
          {dataSeries.map((item) => {
            const last = data[data.length - 1];
            const x = cxMs(new Date(last.date).getTime(), minMs, maxMs);
            const y = cy(last[item.key], min, max);
            return <circle key={item.key} cx={x.toFixed(1)} cy={y.toFixed(1)} r="3.5" fill={item.color} />;
          })}

          {/* Hover crosshair + dots */}
          {hovered && (
            <>
              <line x1={hovered.svgX.toFixed(1)} x2={hovered.svgX.toFixed(1)} y1={MT} y2={MT + CH} stroke="#aaa" strokeWidth="1" strokeDasharray="3 2" />
              {dataSeries.map((item) => (
                <circle
                  key={item.key}
                  cx={hovered.svgX.toFixed(1)}
                  cy={cy(hovered.point[item.key], min, max).toFixed(1)}
                  r="4.5"
                  fill={item.color}
                  stroke="white"
                  strokeWidth="1.5"
                />
              ))}
            </>
          )}
        </svg>

        {/* Tooltip */}
        {hovered && (
          <div
            className="chart-tooltip"
            style={{
              ...tooltipVStyle,
              left: `calc(${hovered.cssXFraction * 100}% + ${(hovered.cssXFraction < 0.6 ? 12 : -12)}px)`,
              transform: hovered.cssXFraction < 0.6 ? "none" : "translateX(-100%)",
            }}
          >
            <div className="chart-tooltip-date">{dateLabel(hovered.point.date)}</div>
            {dataSeries.map((item) => (
              <div key={item.key} className="chart-tooltip-row">
                <span className="chart-tooltip-swatch" style={{ background: item.color }} />
                <span className="chart-tooltip-label">{item.label}</span>
                <span className="chart-tooltip-value">{currency(hovered.point[item.key])}</span>
              </div>
            ))}
            {hovered.point.model > 0 && (
              <div className="chart-tooltip-row">
                <span className="chart-tooltip-swatch" style={{ background: "#b0b0b0" }} />
                <span className="chart-tooltip-label">Model</span>
                <span className="chart-tooltip-value">{currency(hovered.point.model)}</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="chart-footer">
        <div className="chart-legend">
          {dataSeries.map((item) => (
            <span key={item.key}>
              <i style={{ backgroundColor: item.color }} />
              {item.label}
            </span>
          ))}
          <span>
            <i style={{ backgroundColor: "#b0b0b0" }} />
            Model
          </span>
        </div>
      </div>

      {fit && (() => {
        const a = fit.a;
        const aLabel = a >= 1_000_000 ? `$${(a / 1_000_000).toFixed(2)}M` : a >= 1_000 ? `$${(a / 1_000).toFixed(1)}k` : `$${Math.round(a)}`;
        return (
          <p className="chart-equation">
            y = {aLabel} · e<sup>{(fit.b * 100).toFixed(2)}% · t</sup>,&ensp;CAGR ≈ {(fit.annualRate * 100).toFixed(2)}%&ensp;(t = years from {fit.startYear})
            <br />
            R² = {fit.r2.toFixed(4)}
          </p>
        );
      })()}
    </section>
  );
}
