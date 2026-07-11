"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

function parseCents(value: string): bigint | null {
  const normalized = value.replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const [dollars, cents = ""] = normalized.split(".");
  return BigInt(dollars) * BigInt(100) + BigInt(cents.padEnd(2, "0"));
}

// Records a new manual BalanceFetch for each changed account. Balance inputs
// live on the dashboard Liquid/Non-Liquid tables (form association via `form=`).
export async function saveBalances(formData: FormData) {
  const accounts = await prisma.account.findMany({ where: { isActive: true } });

  // Latest balance per account
  const allFetches = await prisma.balanceFetch.findMany({ orderBy: { fetchedAt: "desc" } });
  const currentBalance = new Map<string, bigint>();
  for (const fetch of allFetches) {
    if (!currentBalance.has(fetch.accountId)) {
      currentBalance.set(fetch.accountId, fetch.balanceCents);
    }
  }

  const now = new Date();
  const creates: Parameters<typeof prisma.balanceFetch.create>[0]["data"][] = [];

  for (const account of accounts) {
    const raw = formData.get(`balance-${account.id}`);
    if (typeof raw !== "string") continue;
    const newCents = parseCents(raw);
    if (newCents === null) continue;

    const existing = currentBalance.get(account.id) ?? null;
    if (existing !== null && existing === newCents) continue; // unchanged

    creates.push({
      id: `bf-manual-${account.id}-${randomUUID()}`,
      accountId: account.id,
      balanceCents: newCents,
      currency: "USD",
      source: "manual",
      fetchedAt: now
    });
  }

  if (creates.length > 0) {
    await prisma.$transaction(creates.map((data) => prisma.balanceFetch.create({ data })));
  }

  revalidatePath("/");
  revalidatePath("/annual-returns");
  redirect("/");
}

// Saves a single account balance on blur — used by auto-save in BalanceInputs.
// No redirect; returns silently so the client can stay on the page.
export async function saveSingleBalance(accountId: string, value: string) {
  const cents = parseCents(value);
  if (cents === null) return;

  const latest = await prisma.balanceFetch.findFirst({
    where: { accountId },
    orderBy: { fetchedAt: "desc" },
    select: { balanceCents: true }
  });

  if (latest?.balanceCents === cents) return; // unchanged

  await prisma.balanceFetch.create({
    data: {
      id: `bf-manual-${accountId}-${randomUUID()}`,
      accountId,
      balanceCents: cents,
      currency: "USD",
      source: "manual",
      fetchedAt: new Date()
    }
  });

  revalidatePath("/");
  revalidatePath("/annual-returns");
}
