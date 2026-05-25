import { PrismaClient } from "@prisma/client";
import { accounts, balanceFetches, contributions, snapshotBalances, snapshots } from "../lib/mock-data";

const prisma = new PrismaClient();

function cents(value: number): bigint {
  return BigInt(Math.round(value * 100));
}

function dateAtNoon(value: string): Date {
  return new Date(`${value}T12:00:00-08:00`);
}

function investedByAccountOn(accountId: string, snapshotDate: string): number {
  const date = dateAtNoon(snapshotDate);
  return contributions
    .filter((contribution) => {
      return contribution.accountId === accountId && dateAtNoon(contribution.contributionDate) <= date;
    })
    .reduce((total, contribution) => total + contribution.amount, 0);
}

function annualSnapshotBalances() {
  const latestBalancesByAccount = new Map(balanceFetches.map((fetch) => [fetch.accountId, fetch.balance]));
  const activeAccounts = accounts.filter((account) => account.isActive);
  const currentTotal = activeAccounts.reduce((total, account) => {
    return total + (latestBalancesByAccount.get(account.id) ?? 0);
  }, 0);

  return snapshots.flatMap((snapshot) => {
    const explicitBalances = snapshotBalances.filter((balance) => balance.snapshotId === snapshot.id);
    if (explicitBalances.length > 0) {
      return explicitBalances;
    }

    let allocatedBalance = 0;
    let allocatedInvested = 0;

    return activeAccounts.map((account, index) => {
      const isLast = index === activeAccounts.length - 1;
      const weight = currentTotal === 0 ? 1 / activeAccounts.length : (latestBalancesByAccount.get(account.id) ?? 0) / currentTotal;
      const balance = isLast ? snapshot.netWorthTotal - allocatedBalance : Math.round(snapshot.netWorthTotal * weight);
      const invested = isLast ? snapshot.investedTotal - allocatedInvested : Math.round(snapshot.investedTotal * weight);

      allocatedBalance += balance;
      allocatedInvested += invested;

      return {
        id: `sb-${snapshot.id}-${account.id}`,
        snapshotId: snapshot.id,
        accountId: account.id,
        balance,
        invested,
        growth: balance - invested,
        growthPercentBasisPts: invested === 0 ? undefined : Math.round(((balance - invested) / invested) * 10000)
      };
    });
  });
}

async function main() {
  await prisma.snapshotBalance.deleteMany();
  await prisma.manualAdjustment.deleteMany();
  await prisma.contribution.deleteMany();
  await prisma.snapshot.deleteMany();
  await prisma.balanceFetch.deleteMany();
  await prisma.balanceSyncRun.deleteMany();
  await prisma.account.deleteMany();

  for (const account of accounts) {
    await prisma.account.create({
      data: {
        id: account.id,
        name: account.name,
        institution: account.institution,
        subaccountName: account.subaccountName,
        type: account.type,
        subtype: account.subtype,
        plaidAccountId: account.plaidAccountId,
        isLiquid: account.isLiquid,
        isActive: account.isActive,
        displayOrder: account.displayOrder,
        color: account.color
      }
    });
  }

  await prisma.balanceSyncRun.create({
    data: {
      id: "sync-2026-05-25",
      source: "mock_plaid",
      status: "succeeded",
      startedAt: new Date("2026-05-25T14:19:30-07:00"),
      finishedAt: new Date("2026-05-25T14:20:00-07:00")
    }
  });

  for (const fetch of balanceFetches) {
    await prisma.balanceFetch.create({
      data: {
        id: fetch.id,
        accountId: fetch.accountId,
        syncRunId: fetch.source === "mock_plaid" ? "sync-2026-05-25" : undefined,
        balanceCents: cents(fetch.balance),
        availableBalanceCents:
          fetch.availableBalance === undefined ? undefined : cents(fetch.availableBalance),
        currency: fetch.currency,
        source: fetch.source,
        fetchedAt: new Date(fetch.fetchedAt)
      }
    });
  }

  for (const contribution of contributions) {
    await prisma.contribution.create({
      data: {
        id: contribution.id,
        accountId: contribution.accountId,
        contributionDate: dateAtNoon(contribution.contributionDate),
        amountCents: cents(contribution.amount),
        kind: "contribution",
        note: contribution.note,
        source: "mock_seed",
        yearBucket: dateAtNoon(contribution.contributionDate).getFullYear()
      }
    });
  }

  for (const snapshot of snapshots) {
    await prisma.snapshot.create({
      data: {
        id: snapshot.id,
        snapshotDate: dateAtNoon(snapshot.snapshotDate),
        label: snapshot.label,
        kind: snapshot.kind,
        yearEndForYear:
          snapshot.kind === "year_end" ? dateAtNoon(snapshot.snapshotDate).getFullYear() : undefined,
        investedTotalCents: cents(snapshot.investedTotal),
        netWorthTotalCents: cents(snapshot.netWorthTotal),
        growthTotalCents: cents(snapshot.growthTotal)
      }
    });
  }

  for (const balance of annualSnapshotBalances()) {
    const snapshot = snapshots.find((row) => row.id === balance.snapshotId);
    const invested =
      balance.invested ?? (snapshot ? investedByAccountOn(balance.accountId, snapshot.snapshotDate) : 0);
    const growth = balance.growth ?? balance.balance - invested;

    await prisma.snapshotBalance.create({
      data: {
        id: balance.id,
        snapshotId: balance.snapshotId,
        accountId: balance.accountId,
        balanceCents: cents(balance.balance),
        investedCents: cents(invested),
        growthCents: cents(growth),
        growthPercentBasisPts:
          balance.growthPercentBasisPts ?? (invested === 0 ? undefined : Math.round((growth / invested) * 10000))
      }
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
