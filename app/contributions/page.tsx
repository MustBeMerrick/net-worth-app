import { accountLabel, currency } from "@/lib/calculations";
import { getFinanceData } from "@/lib/db-data";
import { addContribution } from "./actions";
import { ContributionsTable } from "./ContributionsTable";

export const dynamic = "force-dynamic";

export default async function ContributionsPage() {
  const data = await getFinanceData();
  const accountById = new Map(data.accounts.map((account) => [account.id, account]));
  const rows = data.contributions;
  const total = rows.filter((c) => c.kind !== "withdrawal").reduce((sum, c) => sum + c.amount, 0);

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p>Contributions</p>
          <h1>Invested Capital</h1>
        </div>
      </header>

      <section className="metric-grid compact">
        <article className="metric-card">
          <span>Total Recorded</span>
          <strong>{currency(total)}</strong>
          <small>{rows.length} entries</small>
        </article>
      </section>

      <section className="panel form-panel">
        <div className="section-heading">
          <div>
            <p>New Entry</p>
            <h2>Add Contribution</h2>
          </div>
        </div>
        <form className="entry-form" action={addContribution}>
          <label>
            <span>Account</span>
            <select name="accountId" required defaultValue="">
              <option value="" disabled>
                Select account
              </option>
              {data.accounts
                .filter((account) => account.isActive)
                .map((account) => (
                  <option key={account.id} value={account.id}>
                    {accountLabel(account)}
                  </option>
                ))}
            </select>
          </label>
          <label>
            <span>Date</span>
            <input name="contributionDate" type="date" required />
          </label>
          <label>
            <span>Amount</span>
            <input
              name="amount"
              type="number"
              step="0.01"
              inputMode="decimal"
              placeholder="0.00"
              required
            />
          </label>
          <label className="form-field-wide">
            <span>Note</span>
            <input name="note" type="text" placeholder="Source or context" />
          </label>
          <div className="form-actions">
            <button className="action-button action-button-primary" type="submit">
              Add Contribution
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <ContributionsTable rows={rows} accountById={accountById} />
      </section>
    </div>
  );
}
