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
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [rowLeavingId, setRowLeavingId] = useState<string | null>(null);
  const [isToastLeaving, setIsToastLeaving] = useState(false);
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    // Commit any already-pending delete immediately
    if (deleteTimerRef.current) {
      clearTimeout(deleteTimerRef.current);
      deleteTimerRef.current = null;
      if (pendingDelete) deleteContributionById(pendingDelete.id);
    }
    if (exitTimerRef.current) {
      clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
    }

    // Animate the row out, then show toast and start the undo window
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

  // Keep the row in the DOM while it's animating out; hide it after
  const visibleRows = rows.filter((r) => r.id !== pendingDelete?.id || r.id === rowLeavingId);

  return (
    <>
      {pendingDelete && (
        <div className={`undo-toast${isToastLeaving ? " leaving" : ""}`} role="status">
          <span>Deleted <strong>{pendingDelete.label}</strong></span>
          <button className="undo-toast-button" onClick={handleUndo}>Undo</button>
        </div>
      )}

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
              const label = `${dateLabel(contribution.contributionDate)} · ${currency(contribution.amount)}`;
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
