import type { AccountWithBalance } from "@/lib/calculations";
import { currency } from "@/lib/calculations";

type AllocationChartProps = {
  accounts: AccountWithBalance[];
};

export function AllocationChart({ accounts }: AllocationChartProps) {
  const total = accounts.reduce((sum, account) => sum + account.latestBalance, 0);
  const { stops } = accounts.reduce(
    (acc, account) => {
      const start = total === 0 ? 0 : (acc.running / total) * 100;
      const nextRunning = acc.running + account.latestBalance;
      const end = total === 0 ? 0 : (nextRunning / total) * 100;

      return {
        running: nextRunning,
        stops: [...acc.stops, `${account.color} ${start}% ${end}%`]
      };
    },
    { running: 0, stops: [] as string[] }
  );
  const gradientStops = stops.join(", ");

  return (
    <section className="panel allocation-panel">
      <div className="section-heading">
        <div>
          <p>Allocation</p>
          <h2>Account Mix</h2>
        </div>
      </div>
      <div className="allocation-layout">
        <div
          className="donut-chart"
          style={{ background: `conic-gradient(${gradientStops})` }}
          aria-label="Account allocation chart"
        >
          <span>{currency(total)}</span>
        </div>
        <div className="legend-list">
          {accounts.map((account) => (
            <div key={account.id} className="legend-row">
              <span className="swatch" style={{ backgroundColor: account.color }} />
              <span>{account.name}</span>
              <strong>{currency(account.latestBalance)}</strong>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
