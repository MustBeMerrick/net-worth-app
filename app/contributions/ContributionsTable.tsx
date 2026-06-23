"use client";

import { useState, useCallback, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { currencyPrecise, dateLabel } from "@/lib/calculations";
import { institutionAtYear } from "@/lib/account-renames";
import type { Account, Contribution } from "@/lib/mock-data";
import { deleteContributionById, toggleFromGrowth } from "./actions";
import { useToast } from "@/components/ToastProvider";

const EXIT_ANIM_MS = 250;

type Props = {
  rows: Contribution[];
  accountById: Map<string, Account>;
};

export function ContributionsTable({ rows, accountById }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filterAccountId, setFilterAccountId] = useState(searchParams.get("account") ?? "all");
  const [filterYear, setFilterYear] = useState(searchParams.get("year") ?? "all");
  const [filterKind, setFilterKind] = useState(searchParams.get("kind") ?? "all");

  const updateParams = useCallback((account: string, year: string, kind: string) => {
    const params = new URLSearchParams();
    if (account !== "all") params.set("account", account);
    if (year !== "all") params.set("year", year);
    if (kind !== "all") params.set("kind", kind);
    const qs = params.toString();
    router.replace(qs ? `/contributions?${qs}` : "/contributions", { scroll: false });
  }, [router]);

  const { scheduleDelete, pendingId } = useToast();
  const [rowLeavingId, setRowLeavingId] = useState<string | null>(null);
  const [, startToggle] = useTransition();
  // Optimistic overrides for the From Growth flag, keyed by contribution id.
  const [fromGrowthOverrides, setFromGrowthOverrides] = useState<Record<string, boolean>>({});

  function handleToggleFromGrowth(id: string, next: boolean) {
    setFromGrowthOverrides((prev) => ({ ...prev, [id]: next }));
    startToggle(() => {
      toggleFromGrowth(id, next);
    });
  }

  // Derive filter options from full row set
  const accountOptions = Array.from(
    new Map(
      rows
        .map((r) => accountById.get(r.accountId))
        .filter((a): a is Account => a !== undefined)
        .map((a) => [a.id, a])
    ).values()
  ).sort((a, b) => a.institution.localeCompare(b.institution));

  const yearOptions = Array.from(
    new Set(rows.map((r) => new Date(r.contributionDate).getFullYear()))
  ).sort((a, b) => b - a);

  function handleScheduleDelete(id: string, label: string) {
    setRowLeavingId(id);
    setTimeout(() => setRowLeavingId(null), EXIT_ANIM_MS);
    scheduleDelete(id, label, () => deleteContributionById(id));
  }

  const visibleRows = rows.filter((r) => {
    if (r.id === pendingId && r.id !== rowLeavingId) return false;
    if (filterAccountId !== "all" && r.accountId !== filterAccountId) return false;
    if (filterYear !== "all" && new Date(r.contributionDate).getFullYear() !== Number(filterYear)) return false;
    if (filterKind === "contribution" && r.amount <= 0) return false;
    if (filterKind === "withdrawal" && r.amount >= 0) return false;
    return true;
  });

  const filteredTotal = visibleRows
    .filter((r) => r.id !== rowLeavingId && r.id !== pendingId)
    .reduce((sum, r) => sum + r.amount, 0);

  const isFiltered = filterAccountId !== "all" || filterYear !== "all" || filterKind !== "all";

  return (
    <>
      <div className="table-filters">
        <select
          value={filterAccountId}
          onChange={(e) => { setFilterAccountId(e.target.value); updateParams(e.target.value, filterYear, filterKind); }}
          aria-label="Filter by account"
        >
          <option value="all">All accounts</option>
          {accountOptions.map((a) => (
            <option key={a.id} value={a.id}>
              {a.subaccountName ? `${a.institution} – ${a.subaccountName}` : a.institution}
            </option>
          ))}
        </select>

        <select
          value={filterYear}
          onChange={(e) => { setFilterYear(e.target.value); updateParams(filterAccountId, e.target.value, filterKind); }}
          aria-label="Filter by year"
        >
          <option value="all">All years</option>
          {yearOptions.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>

        <select
          value={filterKind}
          onChange={(e) => { setFilterKind(e.target.value); updateParams(filterAccountId, filterYear, e.target.value); }}
          aria-label="Filter by type"
        >
          <option value="all">All types</option>
          <option value="contribution">Deposits</option>
          <option value="withdrawal">Withdrawals</option>
        </select>

        {isFiltered && (
          <span className="filter-total">{currencyPrecise(filteredTotal)}</span>
        )}

        {isFiltered && (
          <button
            className="filter-clear"
            onClick={() => { setFilterAccountId("all"); setFilterYear("all"); setFilterKind("all"); updateParams("all", "all", "all"); }}
          >
            Clear
          </button>
        )}
      </div>

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
            {visibleRows.map((contribution) => {
              const account = accountById.get(contribution.accountId);
              const d = new Date(contribution.contributionDate);
              const year = d.getUTCFullYear();
              const displayInstitution = account
                ? institutionAtYear(account.id, account.institution, year)
                : "Unknown";
              const accountName = account
                ? account.subaccountName
                  ? `${displayInstitution} – ${account.subaccountName}`
                  : displayInstitution
                : "Unknown";
              const mmddyyyy = `${String(d.getUTCMonth() + 1).padStart(2, "0")}/${String(d.getUTCDate()).padStart(2, "0")}/${year}`;
              const label = `${mmddyyyy} · ${accountName} · ${currencyPrecise(contribution.amount)}`;
              return (
                <tr key={contribution.id} className={contribution.id === rowLeavingId ? "row-leaving" : undefined}>
                  <td>{dateLabel(contribution.contributionDate)}</td>
                  <td>
                    <strong>{displayInstitution}</strong>
                    <small>{account?.subaccountName ?? account?.name}</small>
                  </td>
                  <td>
                    <span className="amount-cell">
                      {currencyPrecise(contribution.amount)}
                      {contribution.amount < 0 && (
                        <label className="from-growth-toggle">
                          <input
                            type="checkbox"
                            checked={fromGrowthOverrides[contribution.id] ?? contribution.isFromGrowth ?? false}
                            onChange={(e) => handleToggleFromGrowth(contribution.id, e.target.checked)}
                            aria-label="Exclude this withdrawal from invested totals (from growth)"
                          />
                          <span>from growth</span>
                        </label>
                      )}
                    </span>
                  </td>
                  <td>{contribution.note}</td>
                  <td className="table-action-cell">
                    <button
                      className="icon-button"
                      type="button"
                      onClick={() => handleScheduleDelete(contribution.id, label)}
                      aria-label="Delete contribution"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
