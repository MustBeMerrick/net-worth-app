"use client";

import { useState } from "react";
import type { ExponentialFit } from "@/lib/calculations";

const MS_PER_YEAR = 1000 * 60 * 60 * 24 * 365.25;
const BIRTH_MS = Date.parse("1989-07-19T12:00:00Z");

type Field = "age" | "date" | "nw";

function toISODate(ms: number): string {
  if (!isFinite(ms)) return "";
  return new Date(ms).toISOString().slice(0, 10);
}

// Comma-group a whole-dollar number, e.g. 1234567 -> "1,234,567".
function fmtNum(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

// Comma-group what the user types, preserving a trailing decimal part.
function fmtNwInput(raw: string): string {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  if (cleaned === "") return "";
  const dot = cleaned.indexOf(".");
  const intPart = dot === -1 ? cleaned : cleaned.slice(0, dot);
  const frac = dot === -1 ? "" : cleaned.slice(dot); // includes "."
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + frac;
}

// One shared "anchor moment" drives all three fields off the exponential fit
// y = a·e^(b·t). Whichever field you type into becomes the driver; the other
// two are derived from it. Birth date is fixed (Jul 19, 1989) for age ↔ date.
export function ProjectionCalc({ fit }: { fit: ExponentialFit }) {
  const [driver, setDriver] = useState<Field | null>(null);
  const [value, setValue] = useState("");

  if (!fit) {
    return (
      <aside className="chart-calc">
        <h3 className="chart-calc-title">Projection</h3>
        <p className="chart-calc-empty">Need at least two snapshots to project.</p>
      </aside>
    );
  }

  const { a, b, t0Ms } = fit;

  const nwAtMs = (ms: number) => a * Math.exp((b * (ms - t0Ms)) / MS_PER_YEAR);
  const msAtNw = (v: number) => t0Ms + (Math.log(v / a) / b) * MS_PER_YEAR;
  const ageAtMs = (ms: number) => (ms - BIRTH_MS) / MS_PER_YEAR;
  const msAtAge = (yrs: number) => BIRTH_MS + yrs * MS_PER_YEAR;

  // Resolve the single anchor moment from whichever field is driving.
  let anchorMs = NaN;
  if (driver && value.trim() !== "") {
    if (driver === "date") {
      anchorMs = Date.parse(`${value}T12:00:00Z`);
    } else if (driver === "age") {
      const v = parseFloat(value);
      if (!Number.isNaN(v)) anchorMs = msAtAge(v);
    } else {
      const v = parseFloat(value.replace(/[^0-9.]/g, ""));
      if (!Number.isNaN(v) && v > 0) anchorMs = msAtNw(v);
    }
  }
  const ok = isFinite(anchorMs);

  // Displayed value: raw for the driving field, derived for the others.
  function shown(field: Field): string {
    if (driver === field) return value;
    if (!ok) return "";
    if (field === "date") return toISODate(anchorMs);
    if (field === "age") return ageAtMs(anchorMs).toFixed(2);
    return fmtNum(nwAtMs(anchorMs));
  }

  function onEdit(field: Field, v: string) {
    if (v.trim() === "") {
      setDriver(null);
      setValue("");
      return;
    }
    setDriver(field);
    setValue(field === "nw" ? fmtNwInput(v) : v);
  }

  // Custom age stepper (native number spinner kept the fractional part and
  // desynced). Snap to the nearest whole year in the click direction:
  // 37.42 → 38 up, → 37 down; clean ±1 from a whole number.
  function stepAge(dir: 1 | -1) {
    const cur = parseFloat(shown("age"));
    const base = Number.isNaN(cur) ? 0 : cur;
    setDriver("age");
    setValue(String(dir === 1 ? Math.floor(base) + 1 : Math.ceil(base) - 1));
  }

  return (
    <aside className="chart-calc">
      <h3 className="chart-calc-title">Projection</h3>
      <p className="chart-calc-hint">Fill any one — the other two compute off the fitted curve.</p>

      <div className="chart-calc-grid">
        <label>
          <span>Age (yrs)</span>
          <div className="chart-calc-stepper">
            <input
              type="text"
              inputMode="decimal"
              value={shown("age")}
              onChange={(e) => onEdit("age", e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  stepAge(1);
                } else if (e.key === "ArrowDown") {
                  e.preventDefault();
                  stepAge(-1);
                }
              }}
              placeholder="e.g. 45"
            />
            <span className="chart-calc-spin">
              <button type="button" aria-label="Increase age" onClick={() => stepAge(1)}>
                ▲
              </button>
              <button type="button" aria-label="Decrease age" onClick={() => stepAge(-1)}>
                ▼
              </button>
            </span>
          </div>
        </label>
        <label>
          <span>Date</span>
          <input type="date" value={shown("date")} onChange={(e) => onEdit("date", e.target.value)} />
        </label>
        <label>
          <span>Net worth</span>
          <input
            type="text"
            inputMode="decimal"
            value={shown("nw")}
            onChange={(e) => onEdit("nw", e.target.value)}
            placeholder="e.g. 1,000,000"
          />
        </label>
      </div>
    </aside>
  );
}
