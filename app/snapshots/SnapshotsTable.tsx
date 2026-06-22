"use client";

import { useState } from "react";
import { currencyPrecise, dateLabel, percent } from "@/lib/calculations";
import type { Snapshot } from "@/lib/mock-data";
import { deleteSnapshot } from "./actions";
import { useToast } from "@/components/ToastProvider";

const EXIT_ANIM_MS = 250;

type Props = {
  rows: Snapshot[];
};

export function SnapshotsTable({ rows }: Props) {
  const { scheduleDelete, pendingId } = useToast();
  const [rowLeavingId, setRowLeavingId] = useState<string | null>(null);

  function handleScheduleDelete(id: string, label: string) {
    setRowLeavingId(id);
    setTimeout(() => setRowLeavingId(null), EXIT_ANIM_MS);
    scheduleDelete(id, label, () => deleteSnapshot(id));
  }

  const visibleRows = rows.filter((r) => r.id !== pendingId || r.id === rowLeavingId);

  return (
    <>
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
                    onClick={() => handleScheduleDelete(snapshot.id, snapshot.label)}
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
