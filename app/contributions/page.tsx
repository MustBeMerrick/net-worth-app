import { ActionButton } from "@/components/ActionButton";
import { currency, dateLabel } from "@/lib/calculations";
import { getFinanceData } from "@/lib/db-data";

export const dynamic = "force-dynamic";

export default async function ContributionsPage() {
  const data = await getFinanceData();
  const accountById = new Map(data.accounts.map((account) => [account.id, account]));
  const rows = [...data.contributions].sort((a, b) => b.contributionDate.localeCompare(a.contributionDate));
  const total = rows.reduce((sum, contribution) => sum + contribution.amount, 0);

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p>Contributions</p>
          <h1>Invested Capital</h1>
        </div>
        <div className="action-row">
          <ActionButton tone="primary">Add Contribution</ActionButton>
        </div>
      </header>

      <section className="metric-grid compact">
        <article className="metric-card">
          <span>Total Recorded</span>
          <strong>{currency(total)}</strong>
          <small>{rows.length} mock entries</small>
        </article>
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
