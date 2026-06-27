import { getFinanceData } from "@/lib/db-data";
import { SnapshotsTable } from "@/app/snapshots/SnapshotsTable";
import { ChartsTrendSection } from "./ChartsTrendSection";

export const dynamic = "force-dynamic";

export default async function ChartsPage() {
  const data = await getFinanceData();
  const rows = [...data.snapshots].sort((a, b) => b.snapshotDate.localeCompare(a.snapshotDate));

  return (
    <div className="page-stack">
      <ChartsTrendSection snapshots={data.snapshots} />

      <section className="panel">
        <SnapshotsTable rows={rows} />
      </section>
    </div>
  );
}
