import { Fragment } from "react";
import { currency, getAccountsWithBalances, percent } from "@/lib/calculations";
import { getFinanceData } from "@/lib/db-data";
import { saveBalances } from "./actions";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const data = await getFinanceData();
  const accountRows = getAccountsWithBalances(data);

  // Group accounts by institution, preserving display order
  const groups: { institution: string; accounts: typeof accountRows }[] = [];
  for (const account of accountRows) {
    const last = groups[groups.length - 1];
    if (last && last.institution === account.institution) {
      last.accounts.push(account);
    } else {
      groups.push({ institution: account.institution, accounts: [account] });
    }
  }

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p>Accounts</p>
          <h1>Balances</h1>
        </div>
        <div className="action-row">
          <button className="action-button action-button-primary" type="submit" form="balances-form">
            Save Balances
          </button>
        </div>
      </header>

      <section className="panel">
        <form id="balances-form" action={saveBalances}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Institution</th>
                  <th>Subaccount</th>
                  <th>Invested</th>
                  <th>Balance</th>
                  <th>Growth</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => (
                  <Fragment key={group.institution}>
                    {group.accounts.map((account, index) => (
                      <tr key={account.id} className={index > 0 ? "no-top-border" : undefined}>
                        {index === 0 ? (
                          <td rowSpan={group.accounts.length}><strong>{group.institution}</strong></td>
                        ) : null}
                        <td>{group.accounts.length > 1 ? (account.subaccountName ?? account.name) : null}</td>
                        <td>{currency(account.investedTotal)}</td>
                        <td>
                          <input
                            className="balance-input"
                            name={`balance-${account.id}`}
                            type="text"
                            inputMode="decimal"
                            defaultValue={new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(account.latestBalance)}
                          />
                        </td>
                        <td>
                          {currency(account.growthDollars)}
                          <small>{percent(account.growthPercent)}</small>
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
              <tfoot>
                <tr className="subtotal-row">
                  <td><strong>Total</strong></td>
                  <td />
                  <td>{currency(accountRows.reduce((s, a) => s + a.investedTotal, 0))}</td>
                  <td><span className="balance-total">{currency(accountRows.reduce((s, a) => s + a.latestBalance, 0))}</span></td>
                  <td>{currency(accountRows.reduce((s, a) => s + a.growthDollars, 0))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </form>
      </section>
    </div>
  );
}
