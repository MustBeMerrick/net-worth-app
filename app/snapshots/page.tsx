import { ActionButton } from "@/components/ActionButton";
import { currency, dateLabel, percent } from "@/lib/calculations";
import { getFinanceData } from "@/lib/db-data";

export const dynamic = "force-dynamic";

export default async function SnapshotsPage() {
  const data = await getFinanceData();
  const rows = [...data.snapshots].sort((a, b) => b.snapshotDate.localeCompare(a.snapshotDate));

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p>Snapshots</p>
          <h1>Historical Records</h1>
        </div>
        <div className="action-row">
          <ActionButton tone="primary">Take Snapshot</ActionButton>
          <ActionButton>Mark Snapshot as Year-End</ActionButton>
        </div>
      </header>

      <section className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Label</th>
                <th>Kind</th>
                <th>Invested</th>
                <th>Net Worth</th>
                <th>Growth</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((snapshot) => (
                <tr key={snapshot.id}>
                  <td>{dateLabel(snapshot.snapshotDate)}</td>
                  <td>
                    <strong>{snapshot.label}</strong>
                  </td>
                  <td>
                    <span className="tag">{snapshot.kind.replace("_", " ")}</span>
                  </td>
                  <td>{currency(snapshot.investedTotal)}</td>
                  <td>{currency(snapshot.netWorthTotal)}</td>
                  <td>
                    {currency(snapshot.growthTotal)}
                    <small>{percent((snapshot.growthTotal / snapshot.investedTotal) * 100)}</small>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
