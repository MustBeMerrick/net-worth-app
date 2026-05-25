import { currency, getAnnualReturnBlocks, percent } from "@/lib/calculations";
import { getFinanceData } from "@/lib/db-data";

export const dynamic = "force-dynamic";

export default async function AnnualReturnsPage() {
  const data = await getFinanceData();
  const annualBlocks = getAnnualReturnBlocks(data);

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p>Annual Returns</p>
          <h1>Year-End Blocks</h1>
        </div>
      </header>

      <section className="annual-block-list" aria-label="Annual returns by year">
        {annualBlocks.map((block) => (
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
                </div>
                <div>
                  <span>Return</span>
                  <strong className={block.totalGrowthPercent < 0 ? "negative-cell" : "positive-cell"}>
                    {percent(block.totalGrowthPercent)}
                  </strong>
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
                      <th aria-label="Account" />
                      <th>Total Invested</th>
                      <th>Total Growth (%)</th>
                      <th>Total Growth ($)</th>
                      <th>Dec 31st Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row) => (
                      <tr key={row.account.id}>
                        <th scope="row">{row.account.name}</th>
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
                    <tr className="annual-total-row">
                      <th scope="row">Total</th>
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
        ))}
      </section>
    </div>
  );
}
