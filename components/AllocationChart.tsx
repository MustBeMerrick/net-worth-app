import type { AccountWithBalance } from "@/lib/calculations";
import { currency } from "@/lib/calculations";

type AllocationChartProps = {
  accounts: AccountWithBalance[];
};

type InstitutionSlice = {
  institution: string;
  total: number;
  color: string;
};

function buildInstitutionSlices(accounts: AccountWithBalance[]): InstitutionSlice[] {
  const map = new Map<string, InstitutionSlice>();
  for (const account of accounts) {
    const existing = map.get(account.institution);
    if (existing) {
      existing.total += account.latestBalance;
    } else {
      map.set(account.institution, { institution: account.institution, total: account.latestBalance, color: account.color });
    }
  }
  return Array.from(map.values());
}

function polar(angleDeg: number, r: number): [number, number] {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return [r * Math.cos(rad), r * Math.sin(rad)];
}

function piePath(startDeg: number, endDeg: number, r: number): string {
  const [x1, y1] = polar(startDeg, r);
  const [x2, y2] = polar(endDeg, r);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M 0 0 L ${x1.toFixed(4)} ${y1.toFixed(4)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(4)} ${y2.toFixed(4)} Z`;
}

function pctLabel(p: number): string {
  const r = Math.round(p * 100);
  return r === 0 && p > 0 ? "<1%" : `${r}%`;
}

const R = 106;
const LABEL_R = 66; // radius for the in-slice label
const LEADER_R = R + 8; // elbow radius for the leader line
const OUT_X = 134; // horizontal position of outside labels
const MIN_PCT_FOR_LABEL = 0.04; // below this, label goes outside with a leader

export function AllocationChart({ accounts }: AllocationChartProps) {
  const total = accounts.reduce((sum, a) => sum + a.latestBalance, 0);
  const slices = buildInstitutionSlices(accounts);

  let cursor = 0;
  const sliceData = slices.map((slice) => {
    const pct = total === 0 ? 0 : slice.total / total;
    const sweep = pct * 360;
    const start = cursor;
    const end = cursor + sweep;
    cursor = end;
    const mid = start + sweep / 2;
    const [lx, ly] = polar(mid, LABEL_R); // inside label
    const [ex, ey] = polar(mid, R); // slice edge
    const [mx, my] = polar(mid, LEADER_R); // leader elbow
    const side = mx >= 0 ? 1 : -1;
    return { ...slice, pct, start, end, lx, ly, ex, ey, mx, my, side, labelX: side * OUT_X };
  });

  return (
    <section className="panel allocation-panel">
      <div className="section-heading">
        <div>
          <p>Allocation</p>
          <h2>Account Mix</h2>
        </div>
      </div>
      <div className="allocation-layout">
        <svg
          viewBox="-160 -128 320 256"
          aria-label="Account allocation pie chart"
          style={{ display: "block", width: "100%", maxWidth: 320, height: "auto", margin: "0 auto" }}
        >
          {sliceData.map((slice) => (
            <path key={slice.institution} d={piePath(slice.start, slice.end, R)} fill={slice.color} />
          ))}

          {/* Small slices: leader line + percent outside the pie */}
          {sliceData.map((slice) =>
            slice.pct > 0 && slice.pct < MIN_PCT_FOR_LABEL ? (
              <g key={`lead-${slice.institution}`}>
                <polyline
                  points={`${slice.ex.toFixed(1)},${slice.ey.toFixed(1)} ${slice.mx.toFixed(1)},${slice.my.toFixed(1)} ${slice.labelX},${slice.my.toFixed(1)}`}
                  fill="none"
                  stroke={slice.color}
                  strokeWidth="1"
                />
                <text
                  x={slice.labelX + slice.side * 4}
                  y={slice.my.toFixed(1)}
                  textAnchor={slice.side > 0 ? "start" : "end"}
                  dominantBaseline="middle"
                  fontSize="11"
                  fontWeight="700"
                  fill="#18221e"
                >
                  {pctLabel(slice.pct)}
                </text>
              </g>
            ) : null
          )}

          {/* Larger slices: percent centered inside */}
          {sliceData.map((slice) =>
            slice.pct >= MIN_PCT_FOR_LABEL ? (
              <text
                key={slice.institution}
                x={slice.lx.toFixed(2)}
                y={slice.ly.toFixed(2)}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="11"
                fontWeight="700"
                fill="#fff"
                style={{ paintOrder: "stroke", stroke: "rgba(0,0,0,0.35)", strokeWidth: 3 }}
              >
                {pctLabel(slice.pct)}
              </text>
            ) : null
          )}
        </svg>
        <div className="legend-list">
          {sliceData.map((slice) => (
            <div key={slice.institution} className="legend-row">
              <span className="swatch" style={{ backgroundColor: slice.color }} />
              <span>{slice.institution}</span>
              <strong>{currency(slice.total)}</strong>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
