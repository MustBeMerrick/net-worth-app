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
  revalidatePath("/accounts");
  redirect("/accounts");
}
