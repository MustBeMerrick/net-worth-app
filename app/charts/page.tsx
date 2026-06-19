import { TrendChart } from "@/components/TrendChart";
import { currencyPrecise, dateLabel, getSnapshotChartPoints } from "@/lib/calculations";
import { getFinanceData } from "@/lib/db-data";

export const dynamic = "force-dynamic";

export default async function ChartsPage() {
  const data = await getFinanceData();
  const points = getSnapshotChartPoints(data.snapshots);

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p>Charts</p>
          <h1>Long-Term Progress</h1>
        </div>
        <div className="segmented-control" aria-label="Date range">
          <button type="button">All</button>
          <button type="button">5Y</button>
          <button type="button">1Y</button>
        </div>
      </header>

      <TrendChart snapshots={data.snapshots} />

      <section className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Net Worth</th>
                <th>Invested</th>
                <th>Growth</th>
                <th>Model</th>
              </tr>
            </thead>
            <tbody>
              {[...points].reverse().map((point) => (
                <tr key={point.date}>
                  <td>{dateLabel(point.date)}</td>
                  <td>{currencyPrecise(point.netWorth)}</td>
                  <td>{currencyPrecise(point.invested)}</td>
                  <td>{currencyPrecise(point.growth)}</td>
                  <td>{currencyPrecise(point.model)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
