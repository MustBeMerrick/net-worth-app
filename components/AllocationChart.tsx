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

const R = 108;
const LABEL_R = 72;
const MIN_PCT_FOR_LABEL = 0.04;

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
    const [lx, ly] = polar(mid, LABEL_R);
    return { ...slice, pct, start, end, lx, ly };
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
          viewBox="-120 -120 240 240"
          width="240"
          height="240"
          aria-label="Account allocation pie chart"
          style={{ display: "block", margin: "0 auto" }}
        >
          {sliceData.map((slice) => (
            <path key={slice.institution} d={piePath(slice.start, slice.end, R)} fill={slice.color} />
          ))}
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
                {Math.round(slice.pct * 100)}%
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
