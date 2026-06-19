import { Fragment } from "react";
import { ActionButton } from "@/components/ActionButton";
import { AllocationChart } from "@/components/AllocationChart";
import { MetricCard } from "@/components/MetricCard";
import { TrendChart } from "@/components/TrendChart";
import {
  currency,
  currencyPrecise,
  dateTimeLabel,
  getAccountsWithBalances,
  getDashboardSummary,
  getInstitutionBalanceGroups,
  percent
} from "@/lib/calculations";
import { getFinanceData } from "@/lib/db-data";
import { takeSnapshot } from "@/app/snapshots/actions";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const data = await getFinanceData();
  const accountRows = getAccountsWithBalances(data);
  const liquidGroups = getInstitutionBalanceGroups(accountRows.filter((a) => a.isLiquid));
  const nonLiquidGroups = getInstitutionBalanceGroups(accountRows.filter((a) => !a.isLiquid));
  const summary = getDashboardSummary(data, accountRows);

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p>Dashboard</p>
          <h1>Net Worth Command Center</h1>
        </div>
        <div className="action-row">
          <div className="action-button-stack">
            <ActionButton tone="primary">Sync Plaid Balances</ActionButton>
            {summary.lastPlaidSync ? (
              <small className="action-subtext">synced: {dateTimeLabel(summary.lastPlaidSync)}</small>
            ) : null}
          </div>
          <form action={takeSnapshot}>
            <ActionButton type="submit">Take Snapshot</ActionButton>
          </form>
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
          tone={summary.growthTotal >= 0 ? "positive" : "negative"}
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

      <div className="two-column">
        <section className="panel class-panel">
          <div className="section-heading">
            <div>
              <p>Liquid</p>
              <h2>Cash &amp; Taxable</h2>
            </div>
          </div>
          <div className="table-wrap">
            <table className="compact">
              <thead>
                <tr>
                  <th>Institution</th>
                  <th>Account</th>
                  <th>Balance</th>
                </tr>
              </thead>
              <tbody>
                {liquidGroups.map((group) => (
                  <Fragment key={group.institution}>
                    {group.accounts.map((account, index) => (
                      <tr key={account.id}>
                        <td><strong>{index === 0 ? group.institution : ""}</strong></td>
                        <td>{account.subaccountName ?? account.name}</td>
                        <td>{currencyPrecise(account.latestBalance)}</td>
                      </tr>
                    ))}
                    {group.hasMultipleAccounts ? (
                      <tr className="subtotal-row">
                        <td><strong>{group.institution} Total</strong></td>
                        <td />
                        <td>{currencyPrecise(group.totalBalance)}</td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          <div className="class-total">
            <strong>Total</strong>
            <span />
            <strong>{currencyPrecise(liquidGroups.reduce((s, g) => s + g.totalBalance, 0))}</strong>
          </div>
        </section>

        <section className="panel class-panel">
          <div className="section-heading">
            <div>
              <p>Non-Liquid</p>
              <h2>Retirement &amp; Locked</h2>
            </div>
          </div>
          <div className="table-wrap">
            <table className="compact">
              <thead>
                <tr>
                  <th>Institution</th>
                  <th>Account</th>
                  <th>Balance</th>
                </tr>
              </thead>
              <tbody>
                {nonLiquidGroups.map((group) => (
                  <Fragment key={group.institution}>
                    {group.accounts.map((account, index) => (
                      <tr key={account.id}>
                        <td><strong>{index === 0 ? group.institution : ""}</strong></td>
                        <td>{account.subaccountName ?? account.name}</td>
                        <td>{currencyPrecise(account.latestBalance)}</td>
                      </tr>
                    ))}
                    {group.hasMultipleAccounts ? (
                      <tr className="subtotal-row">
                        <td><strong>{group.institution} Total</strong></td>
                        <td />
                        <td>{currencyPrecise(group.totalBalance)}</td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          <div className="class-total">
            <strong>Total</strong>
            <span />
            <strong>{currencyPrecise(nonLiquidGroups.reduce((s, g) => s + g.totalBalance, 0))}</strong>
          </div>
        </section>

        <AllocationChart accounts={accountRows} />
      </div>

      <TrendChart snapshots={data.snapshots} />
    </div>
  );
}
