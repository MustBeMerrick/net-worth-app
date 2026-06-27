"use client";

import { useMemo, useState } from "react";
import { TrendChart } from "@/components/TrendChart";
import type { Snapshot } from "@/lib/mock-data";

type Range = "all" | "5y" | "1y" | "custom";

const PRESETS: { key: Range; label: string; months: number | null }[] = [
  { key: "all", label: "All", months: null },
  { key: "5y", label: "5Y", months: 60 },
  { key: "1y", label: "1Y", months: 12 },
  { key: "custom", label: "Custom", months: null }
];

function ymd(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function ChartsTrendSection({ snapshots }: { snapshots: Snapshot[] }) {
  const [range, setRange] = useState<Range>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const bounds = useMemo(() => {
    if (snapshots.length === 0) return { min: "", max: "" };
    const times = snapshots.map((s) => new Date(s.snapshotDate).getTime());
    return { min: ymd(Math.min(...times)), max: ymd(Math.max(...times)) };
  }, [snapshots]);

  const effFrom = from || bounds.min;
  const effTo = to || bounds.max;

  const filtered = useMemo(() => {
    if (range === "custom") {
      const fromMs = effFrom ? new Date(`${effFrom}T00:00:00Z`).getTime() : -Infinity;
      const toMs = effTo ? new Date(`${effTo}T23:59:59Z`).getTime() : Infinity;
      return snapshots.filter((s) => {
        const t = new Date(s.snapshotDate).getTime();
        return t >= fromMs && t <= toMs;
      });
    }
    const months = PRESETS.find((r) => r.key === range)?.months ?? null;
    if (months == null) return snapshots;
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);
    const cutoffMs = cutoff.getTime();
    return snapshots.filter((s) => new Date(s.snapshotDate).getTime() >= cutoffMs);
  }, [snapshots, range, effFrom, effTo]);

  return (
    <>
      <header className="page-header">
        <div>
          <p>Charts</p>
          <h1>Long-Term Progress</h1>
        </div>
        <div className="segmented-control" role="group" aria-label="Date range">
          {PRESETS.map((r) => (
            <button
              key={r.key}
              type="button"
              className={range === r.key ? "active" : undefined}
              aria-pressed={range === r.key}
              onClick={() => setRange(r.key)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </header>

      {range === "custom" && (
        <div className="chart-range-custom">
          <label>
            <span>From</span>
            <input
              type="date"
              value={effFrom}
              min={bounds.min}
              max={effTo || bounds.max}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label>
            <span>To</span>
            <input
              type="date"
              value={effTo}
              min={effFrom || bounds.min}
              max={bounds.max}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
        </div>
      )}

      <TrendChart snapshots={filtered} />
    </>
  );
}
