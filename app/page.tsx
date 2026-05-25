import { ActionButton } from "@/components/ActionButton";
import { AllocationChart } from "@/components/AllocationChart";
import { MetricCard } from "@/components/MetricCard";
import { TrendChart } from "@/components/TrendChart";
import {
  currency,
  dateLabel,
  getAccountsWithBalances,
  getDashboardSummary,
  percent
} from "@/lib/calculations";
import { getFinanceData } from "@/lib/db-data";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const data = await getFinanceData();
  const accountRows = getAccountsWithBalances(data);
  const summary = getDashboardSummary(data, accountRows);

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p>Dashboard</p>
          <h1>Net Worth Command Center</h1>
        </div>
        <div className="action-row">
          <ActionButton tone="primary">Sync Plaid Balances</ActionButton>
          <ActionButton>Take Snapshot</ActionButton>
          <ActionButton>Add Contribution</ActionButton>
          <ActionButton>Export Backup</ActionButton>
        </div>
      </header>

      <section className="metric-grid">
        <MetricCard label="Net Worth" value={currency(summary.netWorthTotal)} detail="Latest fetched balances" />
        <MetricCard label="Invested" value={currency(summary.investedTotal)} detail="Recorded contributions" />
        <MetricCard
          label="Growth"
          value={currency(summary.growthTotal)}
          detail={percent(summary.growthPercent)}
          tone="positive"
        />
        <MetricCard label="Liquid" value={currency(summary.liquidTotal)} detail="Cash and taxable accounts" />
        <MetricCard label="Non-Liquid" value={currency(summary.nonLiquidTotal)} detail="Retirement and locked funds" />
        <MetricCard
          label="Liquid Difference"
          value={currency(summary.liquidDifference)}
          detail="Liquid minus non-liquid"
          tone={summary.liquidDifference >= 0 ? "positive" : "negative"}
        />
      </section>

      <section className="status-strip">
        <span>Last Plaid sync: {summary.lastPlaidSync ? dateLabel(summary.lastPlaidSync) : "Never"}</span>
        <span>
          Last snapshot:{" "}
          {summary.lastSnapshot
            ? `${summary.lastSnapshot.label} on ${dateLabel(summary.lastSnapshot.snapshotDate)}`
            : "None"}
        </span>
      </section>

      <div className="two-column">
        <section className="panel">
          <div className="section-heading">
            <div>
              <p>Balances</p>
              <h2>Current Accounts</h2>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Class</th>
                  <th>Balance</th>
                  <th>Growth</th>
                </tr>
              </thead>
              <tbody>
                {accountRows.map((account) => (
                  <tr key={account.id}>
                    <td>
                      <strong>{account.name}</strong>
                      <small>{account.subaccountName ?? account.institution}</small>
                    </td>
                    <td>{account.isLiquid ? "Liquid" : "Non-liquid"}</td>
                    <td>{currency(account.latestBalance)}</td>
                    <td>{currency(account.growthDollars)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <AllocationChart accounts={accountRows} />
      </div>

      <TrendChart snapshots={data.snapshots} />
    </div>
  );
}
