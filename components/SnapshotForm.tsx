"use client";

import { useState } from "react";
import { takeSnapshotCombined } from "@/app/snapshots/actions";

export function SnapshotForm() {
  const [isYearEnd, setIsYearEnd] = useState(false);

  return (
    <form style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.375rem" }} action={takeSnapshotCombined}>
      <button className="action-button action-button-primary" type="submit">
        Take Snapshot
      </button>
      <label style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.875rem", cursor: "pointer", whiteSpace: "nowrap" }}>
        <input
          type="checkbox"
          name="isYearEnd"
          checked={isYearEnd}
          onChange={(e) => setIsYearEnd(e.target.checked)}
        />
        Year End
      </label>
      {isYearEnd && (
        <input
          name="year"
          type="number"
          min="2000"
          max="2100"
          placeholder={String(new Date().getFullYear() - 1)}
          required
          style={{ width: "5rem" }}
        />
      )}
    </form>
  );
}
