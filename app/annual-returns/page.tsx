import { Fragment } from "react";
import { currency, getAccountsWithBalances, getAnnualReturnBlocks, percent } from "@/lib/calculations";
import { getFinanceData } from "@/lib/db-data";

export const dynamic = "force-dynamic";

const CURRENT_YEAR = 2026;

export default async function AnnualReturnsPage() {
  const data = await getFinanceData();
  const accountRows = getAccountsWithBalances(data);
  const annualBlocks = getAnnualReturnBlocks(data);

  const currentYearContribsByAccount = data.contributions
    .filter((c) => new Date(c.contributionDate).getFullYear() === CURRENT_YEAR)
    .reduce<Record<string, number>>((acc, c) => {
      acc[c.accountId] = (acc[c.accountId] ?? 0) + c.amount;
      return acc;
    }, {});
  const currentYearInvested = Object.values(currentYearContribsByAccount).reduce((s, v) => s + v, 0);
  const allTimeInvested = accountRows.reduce((s, a) => s + a.investedTotal, 0);
  const currentYearNetWorth = accountRows.reduce((s, a) => s + a.latestBalance, 0);

  // Prior year-end snapshot for correct 2026 growth baseline
  const prevYearSnapshot = [...data.snapshots]
    .filter((s) => (s.yearEndForYear ?? new Date(s.snapshotDate).getFullYear()) === CURRENT_YEAR - 1)
    .sort((a, b) => b.snapshotDate.localeCompare(a.snapshotDate))[0];
  const prevBalanceByAccount = new Map(
    data.snapshotBalances
      .filter((b) => b.snapshotId === prevYearSnapshot?.id)
      .map((b) => [b.accountId, b])
  );
  const prevYearNetWorth = prevYearSnapshot?.netWorthTotal ?? 0;
  const inProgressGrowth = currentYearNetWorth - currentYearInvested - prevYearNetWorth;
  const inProgressGrowthBase = prevYearNetWorth !== 0 ? prevYearNetWorth : currentYearInvested;
  const inProgressGrowthPercent = inProgressGrowthBase === 0 ? 0 : (inProgressGrowth / inProgressGrowthBase) * 100;

  const allTimeGrowth = currentYearNetWorth - allTimeInvested;
  const allTimeGrowthPercent = allTimeInvested === 0 ? 0 : (allTimeGrowth / allTimeInvested) * 100;

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p>Annual Returns</p>
          <h1>Year-End Blocks</h1>
        </div>
      </header>

      <section className="annual-block-list" aria-label="Annual returns by year">
        {/* To Date block */}
        <article className="panel annual-block">
          <div className="annual-block-header">
            <div>
              <p>All Time</p>
              <h2>To Date</h2>
            </div>
            <div className="annual-summary-grid">
              <div>
                <span>Invested</span>
                <strong>{currency(allTimeInvested)}</strong>
              </div>
              <div>
                <span>Growth</span>
                <strong className={allTimeGrowth < 0 ? "negative-cell" : "positive-cell"}>
                  {currency(allTimeGrowth)}
                </strong>
                <small className={allTimeGrowthPercent < 0 ? "negative-cell" : "positive-cell"}>
                  {percent(allTimeGrowthPercent)}
                </small>
              </div>
              <div>
                <span>Balance</span>
                <strong>{currency(currentYearNetWorth)}</strong>
              </div>
            </div>
          </div>

          <details className="annual-account-dropdown">
            <summary>
              <span>Accounts and brokerages</span>
              <strong>{accountRows.filter((a) => a.latestBalance !== 0 || a.investedTotal !== 0).length} rows</strong>
            </summary>
            <div className="annual-table-wrap">
              <table className="annual-table">
                <thead>
                  <tr>
                    <th>Institution</th>
                    <th>Account</th>
                    <th>Total Invested</th>
                    <th>Total Growth (%)</th>
                    <th>Total Growth ($)</th>
                    <th>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const filtered = accountRows.filter((a) => a.latestBalance !== 0 || a.investedTotal !== 0);
                    const groups: { institution: string; accounts: typeof filtered }[] = [];
                    for (const a of filtered) {
                      const last = groups[groups.length - 1];
                      if (last && last.institution === a.institution) last.accounts.push(a);
                      else groups.push({ institution: a.institution, accounts: [a] });
                    }
                    return groups.map((group) => {
                      const inv = group.accounts.reduce((s, a) => s + a.investedTotal, 0);
                      const bal = group.accounts.reduce((s, a) => s + a.latestBalance, 0);
                      const gro = bal - inv;
                      const groP = inv === 0 ? undefined : (gro / inv) * 100;
                      return (
                        <Fragment key={group.institution}>
                          {group.accounts.map((account) => (
                            <tr key={account.id}>
                              <th scope="row">{account.institution}</th>
                              <td>{account.subaccountName ?? account.name}</td>
                              <td className="money-cell">{currency(account.investedTotal)}</td>
                              <td className={account.growthPercent < 0 ? "negative-cell" : "positive-cell"}>
                                {percent(account.growthPercent)}
                              </td>
                              <td className={account.growthDollars < 0 ? "negative-cell" : "positive-cell"}>
                                {currency(account.growthDollars)}
                              </td>
                              <td className="money-cell">{currency(account.latestBalance)}</td>
                            </tr>
                          ))}
                          {group.accounts.length > 1 && (
                            <tr className="annual-institution-subtotal">
                              <th scope="row">{group.institution}</th>
                              <td>Total</td>
                              <td>{currency(inv)}</td>
                              <td className={groP !== undefined && groP < 0 ? "negative-cell" : "positive-cell"}>
                                {groP === undefined ? "—" : percent(groP)}
                              </td>
                              <td className={gro < 0 ? "negative-cell" : "positive-cell"}>{currency(gro)}</td>
                              <td>{currency(bal)}</td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    });
                  })()}
                  <tr className="annual-total-row">
                    <th scope="row">Total</th>
                    <td />
                    <td>{currency(allTimeInvested)}</td>
                    <td className={allTimeGrowthPercent < 0 ? "negative-cell" : "positive-cell"}>
                      {percent(allTimeGrowthPercent)}
                    </td>
                    <td className={allTimeGrowth < 0 ? "negative-cell" : "positive-cell"}>
                      {currency(allTimeGrowth)}
                    </td>
                    <td>{currency(currentYearNetWorth)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </details>
        </article>

        {/* Current year block */}
        <article className="panel annual-block">
          <div className="annual-block-header">
            <div>
              <p>In Progress</p>
              <h2>{CURRENT_YEAR}</h2>
            </div>
            <div className="annual-summary-grid">
              <div>
                <span>Invested</span>
                <strong>{currency(currentYearInvested)}</strong>
              </div>
              <div>
                <span>Growth</span>
                <strong className={inProgressGrowth < 0 ? "negative-cell" : "positive-cell"}>
                  {currency(inProgressGrowth)}
                </strong>
                <small className={inProgressGrowthPercent < 0 ? "negative-cell" : "positive-cell"}>
                  {percent(inProgressGrowthPercent)}
                </small>
              </div>
              <div>
                <span>Balance</span>
                <strong>{currency(currentYearNetWorth)}</strong>
              </div>
            </div>
          </div>

          <details className="annual-account-dropdown">
            <summary>
              <span>Accounts and brokerages</span>
              <strong>{accountRows.filter((a) => (currentYearContribsByAccount[a.id] ?? 0) !== 0 || a.latestBalance !== 0).length} rows</strong>
            </summary>

            <div className="annual-table-wrap">
              <table className="annual-table">
                <thead>
                  <tr>
                    <th>Institution</th>
                    <th>Account</th>
                    <th>Invested</th>
                    <th>Growth (%)</th>
                    <th>Growth ($)</th>
                    <th>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    type InProgressRow = {
                      account: (typeof accountRows)[number];
                      acctInvested: number;
                      prevDec31Balance: number;
                      acctGrowth: number;
                      acctGrowthPercent: number | undefined;
                    };
                    const filtered: InProgressRow[] = accountRows
                      .filter((a) => (currentYearContribsByAccount[a.id] ?? 0) !== 0 || a.latestBalance !== 0)
                      .map((account) => {
                        const acctInvested = currentYearContribsByAccount[account.id] ?? 0;
                        const prevDec31Balance = prevBalanceByAccount.get(account.id)?.balance ?? 0;
                        const acctGrowth = account.latestBalance - acctInvested - prevDec31Balance;
                        const base = prevDec31Balance !== 0 ? prevDec31Balance : acctInvested;
                        return { account, acctInvested, prevDec31Balance, acctGrowth, acctGrowthPercent: base === 0 ? undefined : (acctGrowth / base) * 100 };
                      });
                    const groups: { institution: string; rows: InProgressRow[] }[] = [];
                    for (const r of filtered) {
                      const last = groups[groups.length - 1];
                      if (last && last.institution === r.account.institution) last.rows.push(r);
                      else groups.push({ institution: r.account.institution, rows: [r] });
                    }
                    return groups.map((group) => {
                      const inv = group.rows.reduce((s, r) => s + r.acctInvested, 0);
                      const bal = group.rows.reduce((s, r) => s + r.account.latestBalance, 0);
                      const gro = group.rows.reduce((s, r) => s + r.acctGrowth, 0);
                      const prevBal = group.rows.reduce((s, r) => s + r.prevDec31Balance, 0);
                      const base = prevBal !== 0 ? prevBal : inv;
                      const groP = base === 0 ? undefined : (gro / base) * 100;
                      return (
                        <Fragment key={group.institution}>
                          {group.rows.map(({ account, acctInvested, acctGrowth, acctGrowthPercent }) => (
                            <tr key={account.id}>
                              <th scope="row">{account.institution}</th>
                              <td>{account.subaccountName ?? account.name}</td>
                              <td className="money-cell">{currency(acctInvested)}</td>
                              <td className={acctGrowthPercent !== undefined && acctGrowthPercent < 0 ? "negative-cell" : "positive-cell"}>
                                {acctGrowthPercent === undefined ? "—" : percent(acctGrowthPercent)}
                              </td>
                              <td className={acctGrowth < 0 ? "negative-cell" : "positive-cell"}>{currency(acctGrowth)}</td>
                              <td className="money-cell">{currency(account.latestBalance)}</td>
                            </tr>
                          ))}
                          {group.rows.length > 1 && (
                            <tr className="annual-institution-subtotal">
                              <th scope="row">{group.institution}</th>
                              <td>Total</td>
                              <td>{currency(inv)}</td>
                              <td className={groP !== undefined && groP < 0 ? "negative-cell" : "positive-cell"}>
                                {groP === undefined ? "—" : percent(groP)}
                              </td>
                              <td className={gro < 0 ? "negative-cell" : "positive-cell"}>{currency(gro)}</td>
                              <td>{currency(bal)}</td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    });
                  })()}

                  <tr className="annual-total-row">
                    <th scope="row">Total</th>
                    <td />
                    <td>{currency(currentYearInvested)}</td>
                    <td className={inProgressGrowthPercent < 0 ? "negative-cell" : "positive-cell"}>
                      {percent(inProgressGrowthPercent)}
                    </td>
                    <td className={inProgressGrowth < 0 ? "negative-cell" : "positive-cell"}>
                      {currency(inProgressGrowth)}
                    </td>
                    <td>{currency(currentYearNetWorth)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </details>
        </article>

        {annualBlocks.map((block) => {
          type RowGroup = {
            institution: string;
            rows: typeof block.rows;
            subtotal?: { invested: number; balance: number; growth: number; growthPercent: number | undefined };
          };

          const rowGroups: RowGroup[] = [];
          for (const row of block.rows) {
            const last = rowGroups[rowGroups.length - 1];
            if (last && last.institution === row.account.institution) {
              last.rows.push(row);
            } else {
              rowGroups.push({ institution: row.account.institution, rows: [row] });
            }
          }
          for (const group of rowGroups) {
            if (group.rows.length > 1) {
              const inv = group.rows.reduce((s, r) => s + r.investedTotal, 0);
              const bal = group.rows.reduce((s, r) => s + r.dec31Balance, 0);
              const gro = group.rows.reduce((s, r) => s + (r.growthDollars ?? 0), 0);
              const prevBal = group.rows.reduce((s, r) => s + (r.dec31Balance - r.investedTotal - (r.growthDollars ?? 0)), 0);
              const base = prevBal !== 0 ? prevBal : inv;
              group.subtotal = { invested: inv, balance: bal, growth: gro, growthPercent: base === 0 ? undefined : (gro / base) * 100 };
            }
          }

          return (
            <article key={block.snapshot.id} className="panel annual-block">
              <div className="annual-block-header">
                <div>
                  <p>Dec 31 Year-End</p>
                  <h2>{block.year}</h2>
                </div>
                <div className="annual-summary-grid">
                  <div>
                    <span>Invested</span>
                    <strong>{currency(block.totalInvested)}</strong>
                  </div>
                  <div>
                    <span>Growth</span>
                    <strong className={block.totalGrowthDollars < 0 ? "negative-cell" : "positive-cell"}>
                      {currency(block.totalGrowthDollars)}
                    </strong>
                    <small className={block.totalGrowthPercent < 0 ? "negative-cell" : "positive-cell"}>
                      {percent(block.totalGrowthPercent)}
                    </small>
                  </div>
                  <div>
                    <span>Balance</span>
                    <strong>{currency(block.totalDec31Balance)}</strong>
                  </div>
                </div>
              </div>

              <details className="annual-account-dropdown">
                <summary>
                  <span>Accounts and brokerages</span>
                  <strong>{block.rows.length} rows</strong>
                </summary>

                <div className="annual-table-wrap">
                  <table className="annual-table">
                    <thead>
                      <tr>
                        <th>Institution</th>
                        <th>Account</th>
                        <th>Total Invested</th>
                        <th>Total Growth (%)</th>
                        <th>Total Growth ($)</th>
                        <th>Dec 31st Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rowGroups.map((group) => (
                        <Fragment key={group.institution}>
                          {group.rows.map((row) => (
                            <tr key={row.account.id}>
                              <th scope="row">{row.account.institution}</th>
                              <td>{row.account.subaccountName ?? row.account.name}</td>
                              <td className="money-cell">{currency(row.investedTotal)}</td>
                              <td className={row.growthPercent !== undefined && row.growthPercent < 0 ? "negative-cell" : "positive-cell"}>
                                {row.growthPercent === undefined ? "0.000%" : percent(row.growthPercent)}
                              </td>
                              <td className={row.growthDollars !== undefined && row.growthDollars < 0 ? "negative-cell" : "positive-cell"}>
                                {currency(row.growthDollars ?? 0)}
                              </td>
                              <td className="money-cell">{currency(row.dec31Balance)}</td>
                            </tr>
                          ))}
                          {group.subtotal && (
                            <tr className="annual-institution-subtotal">
                              <th scope="row">{group.institution}</th>
                              <td>Total</td>
                              <td>{currency(group.subtotal.invested)}</td>
                              <td className={group.subtotal.growthPercent !== undefined && group.subtotal.growthPercent < 0 ? "negative-cell" : "positive-cell"}>
                                {group.subtotal.growthPercent === undefined ? "—" : percent(group.subtotal.growthPercent)}
                              </td>
                              <td className={group.subtotal.growth < 0 ? "negative-cell" : "positive-cell"}>
                                {currency(group.subtotal.growth)}
                              </td>
                              <td>{currency(group.subtotal.balance)}</td>
                            </tr>
                          )}
                        </Fragment>
                      ))}
                      <tr className="annual-total-row">
                        <th scope="row">Total</th>
                        <td />
                        <td>{currency(block.totalInvested)}</td>
                        <td className={block.totalGrowthPercent < 0 ? "negative-cell" : "positive-cell"}>
                          {percent(block.totalGrowthPercent)}
                        </td>
                        <td className={block.totalGrowthDollars < 0 ? "negative-cell" : "positive-cell"}>
                          {currency(block.totalGrowthDollars)}
                        </td>
                        <td>{currency(block.totalDec31Balance)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </details>
            </article>
          );
        })}
      </section>
    </div>
  );
}
