import { ActionButton } from "@/components/ActionButton";
import { currency, dateLabel, getAccountsWithBalances, percent } from "@/lib/calculations";
import { getFinanceData } from "@/lib/db-data";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const data = await getFinanceData();
  const accountRows = getAccountsWithBalances(data);

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p>Accounts</p>
          <h1>Account Classification</h1>
        </div>
        <div className="action-row">
          <ActionButton tone="primary">Edit Account Classification</ActionButton>
          <ActionButton>Sync Plaid Balances</ActionButton>
        </div>
      </header>

      <section className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Institution</th>
                <th>Subaccount</th>
                <th>Type</th>
                <th>Liquidity</th>
                <th>Latest Balance</th>
                <th>Invested</th>
                <th>Growth</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {accountRows.map((account) => (
                <tr key={account.id}>
                  <td>
                    <strong>{account.institution}</strong>
                    <small>{account.name}</small>
                  </td>
                  <td>{account.subaccountName ?? "Primary"}</td>
                  <td>
                    <span className="tag">{account.subtype}</span>
                  </td>
                  <td>{account.isLiquid ? "Liquid" : "Non-liquid"}</td>
                  <td>{currency(account.latestBalance)}</td>
                  <td>{currency(account.investedTotal)}</td>
                  <td>
                    {currency(account.growthDollars)}
                    <small>{percent(account.growthPercent)}</small>
                  </td>
                  <td>
                    {account.source === "mock_plaid" ? "Plaid" : "Manual"}
                    {account.latestFetchedAt ? <small>{dateLabel(account.latestFetchedAt)}</small> : null}
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
