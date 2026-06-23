"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export async function takeSnapshotCombined(formData: FormData) {
  const isYearEnd = formData.get("isYearEnd") === "on";
  if (isYearEnd) {
    return takeYearEndSnapshot(formData);
  }
  return takeSnapshot();
}

export async function takeSnapshot() {
  const [accounts, allFetches, contributionTotals] = await Promise.all([
    prisma.account.findMany({ where: { isActive: true } }),
    prisma.balanceFetch.findMany({ orderBy: { fetchedAt: "desc" } }),
    prisma.contribution.groupBy({
      by: ["accountId"],
      where: { isFromGrowth: false },
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
  revalidatePath("/accounts");
  revalidatePath("/annual-returns");
  revalidatePath("/charts");
  redirect("/accounts");
}

export async function takeYearEndSnapshot(formData: FormData) {
  const year = parseInt(formData.get("year") as string, 10);
  if (!year || year < 2000 || year > 2100) throw new Error("Invalid year.");

  const [accounts, allFetches, contributionTotals] = await Promise.all([
    prisma.account.findMany({ where: { isActive: true } }),
    prisma.balanceFetch.findMany({ orderBy: { fetchedAt: "desc" } }),
    prisma.contribution.groupBy({
      by: ["accountId"],
      where: { yearBucket: { lte: year }, isFromGrowth: false },
      _sum: { amountCents: true }
    })
  ]);

  const latestBalance = new Map<string, bigint>();
  for (const fetch of allFetches) {
    if (!latestBalance.has(fetch.accountId)) {
      latestBalance.set(fetch.accountId, fetch.balanceCents);
    }
  }

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

  const snapshotDate = new Date(`${year}-12-31T12:00:00.000Z`);
  const snapshotId = `snap-${year}-year-end-${randomUUID()}`;

  await prisma.snapshot.create({
    data: {
      id: snapshotId,
      snapshotDate,
      label: `Dec 31, ${year}`,
      kind: "year_end",
      yearEndForYear: year,
      investedTotalCents: totalInvestedCents,
      netWorthTotalCents: totalNetWorthCents,
      growthTotalCents: totalNetWorthCents - totalInvestedCents,
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
  revalidatePath("/accounts");
  revalidatePath("/annual-returns");
  revalidatePath("/charts");
  redirect("/accounts");
}

export async function deleteSnapshot(id: string) {
  await prisma.snapshot.delete({ where: { id } });
  revalidatePath("/");
  revalidatePath("/snapshots");
  revalidatePath("/annual-returns");
  revalidatePath("/charts");
}
