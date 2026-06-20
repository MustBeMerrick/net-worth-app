import { prisma } from "@/lib/prisma";
import type { FinanceData } from "@/lib/calculations";
import type { Account, BalanceFetch, Contribution, Snapshot, SnapshotBalance } from "@/lib/mock-data";

function dollars(cents: bigint): number {
  return Number(cents) / 100;
}

export async function getFinanceData(): Promise<FinanceData> {
  const [accountRows, balanceFetchRows, contributionRows, snapshotRows, snapshotBalanceRows] =
    await Promise.all([
      prisma.account.findMany({ orderBy: { displayOrder: "asc" } }),
      prisma.balanceFetch.findMany({ orderBy: { fetchedAt: "desc" } }),
      prisma.contribution.findMany({
        orderBy: [{ contributionDate: "desc" }, { createdAt: "desc" }]
      }),
      prisma.snapshot.findMany({ orderBy: { snapshotDate: "desc" } }),
      prisma.snapshotBalance.findMany()
    ]);

  const accounts: Account[] = accountRows.map((account) => ({
    id: account.id,
    name: account.name,
    institution: account.institution,
    subaccountName: account.subaccountName ?? undefined,
    type: account.type,
    subtype: account.subtype,
    plaidAccountId: account.plaidAccountId ?? undefined,
    isLiquid: account.isLiquid,
    isActive: account.isActive,
    displayOrder: account.displayOrder,
    color: account.color
  }));

  const balanceFetches: BalanceFetch[] = balanceFetchRows.map((fetch) => ({
    id: fetch.id,
    accountId: fetch.accountId,
    balance: dollars(fetch.balanceCents),
    availableBalance:
      fetch.availableBalanceCents == null ? undefined : dollars(fetch.availableBalanceCents),
    currency: "USD",
    source: fetch.source,
    fetchedAt: fetch.fetchedAt.toISOString()
  }));

  const contributions: Contribution[] = contributionRows.map((contribution) => ({
    id: contribution.id,
    accountId: contribution.accountId,
    contributionDate: contribution.contributionDate.toISOString(),
    amount: dollars(contribution.amountCents),
    createdAt: contribution.createdAt.toISOString(),
    kind: contribution.kind,
    note: contribution.note ?? undefined,
    source: contribution.source
  }));

  const snapshots: Snapshot[] = snapshotRows.map((snapshot) => ({
    id: snapshot.id,
    snapshotDate: snapshot.snapshotDate.toISOString(),
    label: snapshot.label,
    kind: snapshot.kind,
    yearEndForYear: snapshot.yearEndForYear ?? undefined,
    investedTotal: dollars(snapshot.investedTotalCents),
    netWorthTotal: dollars(snapshot.netWorthTotalCents),
    growthTotal: dollars(snapshot.growthTotalCents),
    growthAdjustment: snapshot.growthAdjustmentCents == null ? undefined : dollars(snapshot.growthAdjustmentCents),
    notes: snapshot.notes ?? undefined
  }));

  const snapshotBalances: SnapshotBalance[] = snapshotBalanceRows.map((balance) => ({
    id: balance.id,
    snapshotId: balance.snapshotId,
    accountId: balance.accountId,
    balance: dollars(balance.balanceCents),
    invested: balance.investedCents == null ? undefined : dollars(balance.investedCents),
    growth: balance.growthCents == null ? undefined : dollars(balance.growthCents),
    growthPercentBasisPts: balance.growthPercentBasisPts ?? undefined
  }));

  return {
    accounts,
    balanceFetches,
    contributions,
    snapshots,
    snapshotBalances
  };
}
