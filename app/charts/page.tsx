import { TrendChart } from "@/components/TrendChart";
import { getFinanceData } from "@/lib/db-data";
import { SnapshotsTable } from "@/app/snapshots/SnapshotsTable";

export const dynamic = "force-dynamic";

export default async function ChartsPage() {
  const data = await getFinanceData();
  const rows = [...data.snapshots].sort((a, b) => b.snapshotDate.localeCompare(a.snapshotDate));

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
        <SnapshotsTable rows={rows} />
      </section>
    </div>
  );
}
