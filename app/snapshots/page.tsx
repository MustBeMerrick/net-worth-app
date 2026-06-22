import { ActionButton } from "@/components/ActionButton";
import { takeSnapshot, takeYearEndSnapshot } from "./actions";

export const dynamic = "force-dynamic";

export default async function SnapshotsPage() {
  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p>Snapshots</p>
          <h1>Historical Records</h1>
        </div>
        <div className="action-row">
          <form action={takeSnapshot}>
            <ActionButton tone="primary" type="submit">Take Snapshot</ActionButton>
          </form>
          </div>
      </header>

      <section className="panel form-panel">
        <div className="section-heading">
          <div>
            <p>Year-End</p>
            <h2>Take Year-End Snapshot</h2>
          </div>
        </div>
        <form className="entry-form" action={takeYearEndSnapshot}>
          <label>
            <span>Year</span>
            <input name="year" type="number" min="2000" max="2100" placeholder={String(new Date().getFullYear() - 1)} required />
          </label>
          <div className="form-actions">
            <button className="action-button action-button-primary" type="submit">
              Save Year-End Snapshot
            </button>
          </div>
        </form>
      </section>

    </div>
  );
}
