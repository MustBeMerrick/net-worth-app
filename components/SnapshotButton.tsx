"use client";

import { useState } from "react";

type SnapshotButtonProps = {
  children: React.ReactNode;
  tone?: "primary" | "secondary";
};

export function SnapshotButton({ children, tone = "primary" }: SnapshotButtonProps) {
  const [snapping, setSnapping] = useState(false);

  return (
    <span className="snapshot-btn-wrap">
      <button
        type="submit"
        disabled={snapping}
        className={`action-button action-button-${tone}`}
        onClick={(e) => {
          if (snapping) return;
          e.preventDefault();
          // Submit first so the snapshot is saved right away; the camera is purely cosmetic.
          // requestSubmit runs before setSnapping disables the button, so it still submits.
          e.currentTarget.form?.requestSubmit();
          setSnapping(true);
          setTimeout(() => setSnapping(false), 2000);
        }}
      >
        {children}
      </button>
      {snapping && (
        <span className="snapshot-camera" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="22" height="22">
            <rect x="2" y="7" width="20" height="13" rx="2.5" fill="var(--ink)" />
            <rect x="8" y="4" width="8" height="4" rx="1" fill="var(--ink)" />
            <circle cx="12" cy="13.5" r="4.3" fill="var(--bg)" />
            <circle cx="12" cy="13.5" r="2.3" fill="var(--ink)" />
          </svg>
          <span className="snapshot-camera-flash" />
        </span>
      )}
    </span>
  );
}
