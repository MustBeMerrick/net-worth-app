"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export async function takeSnapshot() {
  const [accounts, allFetches, contributionTotals] = await Promise.all([
    prisma.account.findMany({ where: { isActive: true } }),
    prisma.balanceFetch.findMany({ orderBy: { fetchedAt: "desc" } }),
    prisma.contribution.groupBy({
      by: ["accountId"],
      _sum: { amountCents: true }
    })
  ]);

  // Latest balance per account
  const latestBalance = new Map<string, bigint>();
  for (const fetch of allFetches) {
    if (!latestBalance.has(fetch.accountId)) {
      latestBalance.set(fetch.accountId, fetch.balanceCents);
    }
  }

  // Invested total per account
  const investedByAccount = new Map<string, bigint>(
    contributionTotals.map((row) => [row.accountId, row._sum.amountCents ?? BigInt(0)])
  );

  const totalNetWorthCents = accounts.reduce(
    (sum, a) => sum + (latestBalance.get(a.id) ?? BigInt(0)),
    BigInt(0)
  );
  const totalInvestedCents = accounts.reduce(
    (sum, a) => sum + (investedByAccount.get(a.id) ?? BigInt(0)),
    BigInt(0)
  );
  const totalGrowthCents = totalNetWorthCents - totalInvestedCents;

  const now = new Date();
  const label = now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const dateStr = now.toISOString().slice(0, 10);
  const snapshotId = `snap-${dateStr}-${randomUUID()}`;

  await prisma.snapshot.create({
    data: {
      id: snapshotId,
      snapshotDate: now,
      label,
      kind: "manual",
      investedTotalCents: totalInvestedCents,
      netWorthTotalCents: totalNetWorthCents,
      growthTotalCents: totalGrowthCents,
      balances: {
        create: accounts.map((account) => {
          const balanceCents = latestBalance.get(account.id) ?? BigInt(0);
          const investedCents = investedByAccount.get(account.id) ?? BigInt(0);
          return {
            id: `sb-${snapshotId}-${account.id}`,
            accountId: account.id,
            balanceCents,
            investedCents,
            growthCents: balanceCents - investedCents
          };
        })
      }
    }
  });

  revalidatePath("/");
  revalidatePath("/snapshots");
  revalidatePath("/annual-returns");
  revalidatePath("/charts");
  redirect("/snapshots");
}

export async function deleteSnapshot(id: string) {
  await prisma.snapshot.delete({ where: { id } });
  revalidatePath("/");
  revalidatePath("/snapshots");
  revalidatePath("/annual-returns");
  revalidatePath("/charts");
}
