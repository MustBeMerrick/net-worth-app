"use client";

import { useRef, useState } from "react";
import { currencyPrecise, dateLabel, percent } from "@/lib/calculations";
import type { Snapshot } from "@/lib/mock-data";
import { deleteSnapshot } from "./actions";

const UNDO_DELAY_MS = 5000;
const EXIT_ANIM_MS = 250;

type Props = {
  rows: Snapshot[];
};

type PendingDelete = {
  id: string;
  label: string;
};

export function SnapshotsTable({ rows }: Props) {
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
    if (deleteTimerRef.current) {
      clearTimeout(deleteTimerRef.current);
      deleteTimerRef.current = null;
      if (pendingDelete) deleteSnapshot(pendingDelete.id);
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
      startToastExit(() => deleteSnapshot(id));
    }, UNDO_DELAY_MS);
  }

  function handleUndo() {
    if (deleteTimerRef.current) {
      clearTimeout(deleteTimerRef.current);
      deleteTimerRef.current = null;
    }
    startToastExit(() => {});
  }

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
              <th>Label</th>
              <th>Kind</th>
              <th>Invested</th>
              <th>Net Worth</th>
              <th>Growth</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((snapshot) => (
              <tr key={snapshot.id} className={snapshot.id === rowLeavingId ? "row-leaving" : undefined}>
                <td>{dateLabel(snapshot.snapshotDate)}</td>
                <td><strong>{snapshot.label}</strong></td>
                <td><span className="tag">{snapshot.kind.replace("_", " ")}</span></td>
                <td>{currencyPrecise(snapshot.investedTotal)}</td>
                <td>{currencyPrecise(snapshot.netWorthTotal)}</td>
                <td>
                  {currencyPrecise(snapshot.growthTotal)}
                  <small>{percent((snapshot.growthTotal / snapshot.investedTotal) * 100)}</small>
                </td>
                <td>
                  <button
                    className="delete-button"
                    type="button"
                    onClick={() => scheduleDelete(snapshot.id, snapshot.label)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
