"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

const UNDO_DELAY_MS = 5000;
const EXIT_ANIM_MS = 250;

type PendingDelete = {
  id: string;
  label: string;
  commit: () => void;
};

type ToastContextValue = {
  scheduleDelete: (id: string, label: string, commit: () => void) => void;
  cancelDelete: (id: string) => void;
  pendingId: string | null;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<PendingDelete | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);
  const deleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = () => {
    if (deleteTimer.current) { clearTimeout(deleteTimer.current); deleteTimer.current = null; }
    if (exitTimer.current) { clearTimeout(exitTimer.current); exitTimer.current = null; }
  };

  const dismiss = useCallback((onDone?: () => void) => {
    setIsLeaving(true);
    exitTimer.current = setTimeout(() => {
      setPending(null);
      setIsLeaving(false);
      exitTimer.current = null;
      onDone?.();
    }, EXIT_ANIM_MS);
  }, []);

  const scheduleDelete = useCallback((id: string, label: string, commit: () => void) => {
    clearTimers();
    // If there was a previous pending, commit it immediately before starting new one
    setPending((prev) => {
      if (prev) prev.commit();
      return null;
    });

    setPending({ id, label, commit });
    setIsLeaving(false);

    deleteTimer.current = setTimeout(() => {
      deleteTimer.current = null;
      dismiss(() => commit());
    }, UNDO_DELAY_MS);
  }, [dismiss]);

  const cancelDelete = useCallback((id: string) => {
    setPending((prev) => {
      if (prev?.id !== id) return prev;
      clearTimers();
      dismiss();
      return prev;
    });
  }, [dismiss]);

  function handleUndo() {
    clearTimers();
    dismiss();
  }

  return (
    <ToastContext.Provider value={{ scheduleDelete, cancelDelete, pendingId: pending?.id ?? null }}>
      {children}
      {pending && (
        <div className={`undo-toast${isLeaving ? " leaving" : ""}`} role="status">
          <span>Deleted <strong>{pending.label}</strong></span>
          <button className="undo-toast-button" onClick={handleUndo}>Undo</button>
        </div>
      )}
    </ToastContext.Provider>
  );
}
