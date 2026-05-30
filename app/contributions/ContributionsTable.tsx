"use client";

import { useRef, useState } from "react";
import { currency, dateLabel } from "@/lib/calculations";
import type { Account, Contribution } from "@/lib/mock-data";
import { deleteContributionById } from "./actions";
import { KindSelector } from "./KindSelector";

const UNDO_DELAY_MS = 5000;
const EXIT_ANIM_MS = 250;

type Props = {
  rows: Contribution[];
  accountById: Map<string, Account>;
};

type PendingDelete = {
  id: string;
  label: string;
};

export function ContributionsTable({ rows, accountById }: Props) {
  const [filterAccountId, setFilterAccountId] = useState("all");
  const [filterYear, setFilterYear] = useState("all");
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [rowLeavingId, setRowLeavingId] = useState<string | null>(null);
  const [isToastLeaving, setIsToastLeaving] = useState(false);
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  function startToastExit(onDone: () => void) {
    setIsToastLeaving(true);
    exitTimerRef.current = setTimeout(() => {
      setPendingDelete(null);
      setIsToastLeaving(false);
      exitTimerRef.current = null;
      onDone();
    }, EXIT_ANIM_MS);
  }

  function scheduleDelete(id: string, label: string) {
    if (deleteTimerRef.current) {
      clearTimeout(deleteTimerRef.current);
      deleteTimerRef.current = null;
      if (pendingDelete) deleteContributionById(pendingDelete.id);
    }
    if (exitTimerRef.current) {
      clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
    }

    setRowLeavingId(id);
    setPendingDelete({ id, label });
    setIsToastLeaving(false);
    setTimeout(() => setRowLeavingId(null), EXIT_ANIM_MS);

    deleteTimerRef.current = setTimeout(() => {
      deleteTimerRef.current = null;
      startToastExit(() => deleteContributionById(id));
    }, UNDO_DELAY_MS);
  }

  function handleUndo() {
    if (deleteTimerRef.current) {
      clearTimeout(deleteTimerRef.current);
      deleteTimerRef.current = null;
    }
    startToastExit(() => {});
  }

  const visibleRows = rows.filter((r) => {
    if (r.id === pendingDelete?.id && r.id !== rowLeavingId) return false;
    if (filterAccountId !== "all" && r.accountId !== filterAccountId) return false;
    if (filterYear !== "all" && new Date(r.contributionDate).getFullYear() !== Number(filterYear)) return false;
    return true;
  });

  const filteredTotal = visibleRows
    .filter((r) => r.id !== rowLeavingId && r.kind !== "withdrawal")
    .reduce((sum, r) => sum + r.amount, 0);

  const isFiltered = filterAccountId !== "all" || filterYear !== "all";

  return (
    <>
      {pendingDelete && (
        <div className={`undo-toast${isToastLeaving ? " leaving" : ""}`} role="status">
          <span>Deleted <strong>{pendingDelete.label}</strong></span>
          <button className="undo-toast-button" onClick={handleUndo}>Undo</button>
        </div>
      )}

      <div className="table-filters">
        <select
          value={filterAccountId}
          onChange={(e) => setFilterAccountId(e.target.value)}
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
          onChange={(e) => setFilterYear(e.target.value)}
          aria-label="Filter by year"
        >
          <option value="all">All years</option>
          {yearOptions.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>

        {isFiltered && (
          <span className="filter-total">{currency(filteredTotal)}</span>
        )}

        {isFiltered && (
          <button
            className="filter-clear"
            onClick={() => { setFilterAccountId("all"); setFilterYear("all"); }}
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
              const accountName = account
                ? account.subaccountName
                  ? `${account.institution} – ${account.subaccountName}`
                  : account.institution
                : "Unknown";
              const d = new Date(contribution.contributionDate);
              const mmddyyyy = `${String(d.getUTCMonth() + 1).padStart(2, "0")}/${String(d.getUTCDate()).padStart(2, "0")}/${d.getUTCFullYear()}`;
              const label = `${mmddyyyy} · ${accountName} · ${currency(contribution.amount)}`;
              return (
                <tr key={contribution.id} className={contribution.id === rowLeavingId ? "row-leaving" : undefined}>
                  <td>{dateLabel(contribution.contributionDate)}</td>
                  <td>
                    <strong>{account?.institution ?? "Unknown"}</strong>
                    <small>{account?.subaccountName ?? account?.name}</small>
                  </td>
                  <td>
                    {currency(contribution.amount)}
                    {contribution.amount < 0 && (
                      <KindSelector contributionId={contribution.id} kind={contribution.kind} />
                    )}
                  </td>
                  <td>{contribution.note}</td>
                  <td className="table-action-cell">
                    <button
                      className="icon-button"
                      type="button"
                      onClick={() => scheduleDelete(contribution.id, label)}
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
