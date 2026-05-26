import { accountLabel, currency, dateLabel } from "@/lib/calculations";
import { getFinanceData } from "@/lib/db-data";
import { addContribution, deleteContribution } from "./actions";

export const dynamic = "force-dynamic";

export default async function ContributionsPage() {
  const data = await getFinanceData();
  const accountById = new Map(data.accounts.map((account) => [account.id, account]));
  const rows = data.contributions;
  const total = rows.reduce((sum, contribution) => sum + contribution.amount, 0);

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
              min="0.01"
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
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Account</th>
                <th>Amount</th>
                <th>Note</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((contribution) => {
                const account = accountById.get(contribution.accountId);
                return (
                  <tr key={contribution.id}>
                    <td>{dateLabel(contribution.contributionDate)}</td>
                    <td>
                      <strong>{account?.institution ?? "Unknown"}</strong>
                      <small>{account?.subaccountName ?? account?.name}</small>
                    </td>
                    <td>{currency(contribution.amount)}</td>
                    <td>{contribution.note}</td>
                    <td className="table-action-cell">
                      <form action={deleteContribution}>
                        <input type="hidden" name="contributionId" value={contribution.id} />
                        <button className="icon-button" type="submit" aria-label="Delete contribution">
                          Delete
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
