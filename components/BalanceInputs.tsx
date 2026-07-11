"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { saveSingleBalance } from "@/app/actions";

function formatBalance(raw: string): string {
  const normalized = raw.replace(/[$,\s]/g, "");
  if (!normalized) return raw;
  const num = parseFloat(normalized);
  if (isNaN(num)) return raw;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
}

type Edit = { id: string; from: string; to: string };

type BalanceCtx = {
  values: Record<string, string>;
  change: (id: string, v: string, dflt: string) => void;
  commit: (id: string, v: string, dflt: string) => void;
};

const Ctx = createContext<BalanceCtx | null>(null);

export function BalanceHistoryProvider({ children }: { children: ReactNode }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const committed = useRef<Record<string, string>>({});
  const history = useRef<Edit[]>([]);
  const index = useRef(-1);
  const [, startTransition] = useTransition();

  const save = useCallback((id: string, v: string) => {
    startTransition(() => { saveSingleBalance(id, v); });
  }, []);

  const change = useCallback((id: string, v: string, dflt: string) => {
    if (!(id in committed.current)) committed.current[id] = dflt;
    setValues((prev) => ({ ...prev, [id]: v }));
  }, []);

  const commit = useCallback((id: string, v: string, dflt: string) => {
    const base = id in committed.current ? committed.current[id] : dflt;
    if (v === base) return;
    history.current = history.current.slice(0, index.current + 1);
    history.current.push({ id, from: base, to: v });
    index.current = history.current.length - 1;
    committed.current[id] = v;
    save(id, v);
  }, [save]);

  const undo = useCallback(() => {
    if (index.current < 0) return;
    const edit = history.current[index.current];
    committed.current[edit.id] = edit.from;
    setValues((prev) => ({ ...prev, [edit.id]: edit.from }));
    index.current -= 1;
    save(edit.id, edit.from);
  }, [save]);

  const redo = useCallback(() => {
    if (index.current >= history.current.length - 1) return;
    index.current += 1;
    const edit = history.current[index.current];
    committed.current[edit.id] = edit.to;
    setValues((prev) => ({ ...prev, [edit.id]: edit.to }));
    save(edit.id, edit.to);
  }, [save]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey)) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) {
        if (index.current >= 0) { e.preventDefault(); undo(); }
      } else if ((k === "z" && e.shiftKey) || k === "y") {
        if (index.current < history.current.length - 1) { e.preventDefault(); redo(); }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  return <Ctx.Provider value={{ values, change, commit }}>{children}</Ctx.Provider>;
}

export function BalanceInput({ accountId, defaultValue }: { accountId: string; defaultValue: string }) {
  const ctx = useContext(Ctx);
  const focusVal = useRef(defaultValue);
  const value = ctx && accountId in ctx.values ? ctx.values[accountId] : defaultValue;

  const base = {
    className: "balance-input",
    form: "balances-form",
    name: `balance-${accountId}`,
    type: "text" as const,
    inputMode: "decimal" as const,
    autoComplete: "off",
  };

  if (!ctx) return <input {...base} defaultValue={defaultValue} />;

  return (
    <input
      {...base}
      value={value}
      onFocus={(e) => { focusVal.current = e.currentTarget.value; }}
      onChange={(e) => ctx.change(accountId, e.target.value, defaultValue)}
      onBlur={(e) => {
        const formatted = formatBalance(e.currentTarget.value);
        ctx.change(accountId, formatted, defaultValue);
        ctx.commit(accountId, formatted, defaultValue);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          ctx.change(accountId, focusVal.current, defaultValue);
        } else if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur(); // triggers onBlur → format + commit + save
        }
      }}
    />
  );
}
