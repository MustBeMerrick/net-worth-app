"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

function fieldValue(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function parseAmountCents(value: string): bigint {
  const normalized = value.replace(/[$,\s]/g, "");
  const negative = normalized.startsWith("-");
  const abs = negative ? normalized.slice(1) : normalized;
  if (!/^\d+(\.\d{1,2})?$/.test(abs)) {
    throw new Error("Amount must be a dollar value with up to two decimal places.");
  }

  const [dollars, cents = ""] = abs.split(".");
  const amountCents = BigInt(dollars) * BigInt(100) + BigInt(cents.padEnd(2, "0"));

  if (amountCents === BigInt(0)) {
    throw new Error("Amount must be non-zero.");
  }

  return negative ? -amountCents : amountCents;
}

function parseContributionDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("Contribution date is required.");
  }

  return new Date(`${value}T12:00:00-08:00`);
}

export async function addContribution(formData: FormData) {
  const accountId = fieldValue(formData, "accountId");
  const contributionDateValue = fieldValue(formData, "contributionDate");
  const amountValue = fieldValue(formData, "amount");
  const note = fieldValue(formData, "note");

  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: { id: true }
  });

  if (!account) {
    throw new Error("Select a valid account.");
  }

  const contributionDate = parseContributionDate(contributionDateValue);
  const amountCents = parseAmountCents(amountValue);

  await prisma.contribution.create({
    data: {
      id: `contrib-${contributionDateValue}-${accountId}-${randomUUID()}`,
      account: {
        connect: { id: accountId }
      },
      contributionDate,
      amountCents,
      kind: "contribution",
      note: note || null,
      source: "manual",
      yearBucket: contributionDate.getFullYear()
    }
  });

  revalidatePath("/");
  revalidatePath("/accounts");
  revalidatePath("/contributions");
  revalidatePath("/annual-returns");

  const filterAccount = fieldValue(formData, "_account");
  const filterYear = fieldValue(formData, "_year");
  const filterKind = fieldValue(formData, "_kind");
  const qs = new URLSearchParams();
  if (filterAccount) qs.set("account", filterAccount);
  if (filterYear) qs.set("year", filterYear);
  if (filterKind) qs.set("kind", filterKind);
  const qStr = qs.toString();
  redirect(qStr ? `/contributions?${qStr}` : "/contributions");
}

export async function updateContributionKind(contributionId: string, kind: "contribution" | "withdrawal") {
  await prisma.contribution.update({
    where: { id: contributionId },
    data: { kind }
  });

  revalidatePath("/");
  revalidatePath("/accounts");
  revalidatePath("/contributions");
  revalidatePath("/annual-returns");
}

export async function toggleFromGrowth(contributionId: string, isFromGrowth: boolean) {
  const contribution = await prisma.contribution.findUnique({
    where: { id: contributionId },
    select: { id: true, accountId: true, yearBucket: true, amountCents: true, isFromGrowth: true }
  });

  if (!contribution) {
    throw new Error("Contribution not found.");
  }

  // No-op if the flag is already in the requested state — avoids double-applying the delta.
  if (contribution.isFromGrowth === isFromGrowth) {
    return;
  }

  const { accountId, yearBucket, amountCents } = contribution;

  // Flagging from-growth removes this contribution's amount from cumulative invested;
  // clearing the flag re-adds it. The adjustment is exactly the contribution amount — we
  // do NOT recompute invested from the contributions table, because historical snapshot
  // invested totals were entered from statements and are not a sum of contribution rows.
  // (Withdrawals are negative, so excluding one raises invested by its magnitude.)
  const investedDelta = isFromGrowth ? -amountCents : amountCents;

  // Year-end snapshots whose cumulative invested includes this contribution.
  // Manual snapshots are intentionally left untouched (their totals are frozen at capture time).
  const affectedSnapshots = await prisma.snapshot.findMany({
    where: {
      kind: "year_end",
      yearEndForYear: yearBucket == null ? undefined : { gte: yearBucket }
    },
    select: { id: true, investedTotalCents: true, growthTotalCents: true }
  });

  await prisma.$transaction(async (tx) => {
    await tx.contribution.update({
      where: { id: contributionId },
      data: { isFromGrowth }
    });

    for (const snapshot of affectedSnapshots) {
      // Net worth is unchanged, so growth moves opposite to invested.
      await tx.snapshot.update({
        where: { id: snapshot.id },
        data: {
          investedTotalCents: snapshot.investedTotalCents + investedDelta,
          growthTotalCents: snapshot.growthTotalCents - investedDelta
        }
      });

      const sb = await tx.snapshotBalance.findUnique({
        where: { snapshotId_accountId: { snapshotId: snapshot.id, accountId } }
      });
      if (!sb) continue;

      // growthCents is an override that is normally null — when null, annual-returns
      // computes per-year growth on the fly, so leave it null. Only adjust an existing
      // override so balance = invested + growth stays consistent.
      await tx.snapshotBalance.update({
        where: { id: sb.id },
        data: {
          investedCents: (sb.investedCents ?? BigInt(0)) + investedDelta,
          ...(sb.growthCents === null ? {} : { growthCents: sb.growthCents - investedDelta })
        }
      });
    }
  });

  revalidatePath("/");
  revalidatePath("/contributions");
  revalidatePath("/annual-returns");
  revalidatePath("/snapshots");
}

export async function bulkSetFromGrowth(contributionIds: string[], isFromGrowth: boolean) {
  if (contributionIds.length === 0) return;

  // Only the rows actually changing state contribute a delta (mirrors the
  // single-row no-op guard in toggleFromGrowth).
  const changed = await prisma.contribution.findMany({
    where: { id: { in: contributionIds }, isFromGrowth: { not: isFromGrowth } },
    select: { id: true, accountId: true, yearBucket: true, amountCents: true }
  });

  if (changed.length === 0) return;

  // Flagging from-growth removes the amount from cumulative invested; clearing re-adds it.
  // (Withdrawals are negative, so excluding one raises invested by its magnitude.)
  const sign = isFromGrowth ? BigInt(-1) : BigInt(1);

  // A contribution affects every year_end snapshot at or after its yearBucket.
  const affectedSnapshots = await prisma.snapshot.findMany({
    where: { kind: "year_end" },
    select: { id: true, yearEndForYear: true, investedTotalCents: true, growthTotalCents: true }
  });

  await prisma.$transaction(async (tx) => {
    await tx.contribution.updateMany({
      where: { id: { in: changed.map((c) => c.id) } },
      data: { isFromGrowth }
    });

    for (const snapshot of affectedSnapshots) {
      const relevant = changed.filter(
        (c) => c.yearBucket != null && snapshot.yearEndForYear != null && c.yearBucket <= snapshot.yearEndForYear
      );
      if (relevant.length === 0) continue;

      const totalDelta = relevant.reduce((sum, c) => sum + sign * c.amountCents, BigInt(0));

      // Net worth is unchanged, so growth moves opposite to invested.
      await tx.snapshot.update({
        where: { id: snapshot.id },
        data: {
          investedTotalCents: snapshot.investedTotalCents + totalDelta,
          growthTotalCents: snapshot.growthTotalCents - totalDelta
        }
      });

      // Per-account adjustment on each affected SnapshotBalance.
      const perAccount = new Map<string, bigint>();
      for (const c of relevant) {
        perAccount.set(c.accountId, (perAccount.get(c.accountId) ?? BigInt(0)) + sign * c.amountCents);
      }

      for (const [accountId, acctDelta] of perAccount) {
        const sb = await tx.snapshotBalance.findUnique({
          where: { snapshotId_accountId: { snapshotId: snapshot.id, accountId } }
        });
        if (!sb) continue;

        // growthCents is an override that is normally null — when null, annual-returns
        // computes per-year growth on the fly, so leave it null. Only adjust an existing override.
        await tx.snapshotBalance.update({
          where: { id: sb.id },
          data: {
            investedCents: (sb.investedCents ?? BigInt(0)) + acctDelta,
            ...(sb.growthCents === null ? {} : { growthCents: sb.growthCents - acctDelta })
          }
        });
      }
    }
  });

  revalidatePath("/");
  revalidatePath("/contributions");
  revalidatePath("/annual-returns");
  revalidatePath("/snapshots");
}

export async function deleteContribution(formData: FormData) {
  const contributionId = fieldValue(formData, "contributionId");

  if (!contributionId) {
    throw new Error("Contribution id is required.");
  }

  await prisma.contribution.delete({
    where: { id: contributionId }
  });

  revalidatePath("/");
  revalidatePath("/accounts");
  revalidatePath("/contributions");
  revalidatePath("/annual-returns");
  redirect("/contributions");
}

export async function deleteContributionById(contributionId: string) {
  await prisma.contribution.delete({
    where: { id: contributionId }
  });

  revalidatePath("/");
  revalidatePath("/accounts");
  revalidatePath("/contributions");
  revalidatePath("/annual-returns");
}
