import {
  accounts,
  balanceFetches,
  contributions,
  snapshotBalances,
  snapshots,
  type Account,
  type BalanceFetch,
  type Contribution,
  type SnapshotBalance,
  type Snapshot
} from "@/lib/mock-data";

export type FinanceData = {
  accounts: Account[];
  balanceFetches: BalanceFetch[];
  contributions: Contribution[];
  snapshots: Snapshot[];
  snapshotBalances: SnapshotBalance[];
};

export const mockFinanceData: FinanceData = {
  accounts,
  balanceFetches,
  contributions,
  snapshots,
  snapshotBalances
};

export type AccountWithBalance = Account & {
  latestBalance: number;
  latestFetchedAt?: string;
  source?: BalanceFetch["source"];
  investedTotal: number;
  growthDollars: number;
  growthPercent: number;
};

export type DashboardSummary = {
  netWorthTotal: number;
  investedTotal: number;
  growthTotal: number;
  growthPercent: number;
  liquidTotal: number;
  nonLiquidTotal: number;
  liquidDifference: number;
  lastPlaidSync?: string;
  lastSnapshot?: Snapshot;
};

export type AnnualAccountReturn = {
  account: Account;
  investedTotal: number;
  growthPercent: number | undefined;
  growthDollars: number | undefined;
  dec31Balance: number;
};

export type AnnualReturnBlock = {
  year: number;
  snapshot: Snapshot;
  rows: AnnualAccountReturn[];
  totalInvested: number;
  totalGrowthPercent: number;
  totalGrowthDollars: number;
  totalDec31Balance: number;
};

export function currency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}

export function percent(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "percent",
    maximumFractionDigits: 1
  }).format(value / 100);
}

export function dateLabel(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value));
}

export function getLatestBalanceFetches(fetches: BalanceFetch[] = balanceFetches): Map<string, BalanceFetch> {
  return fetches.reduce((latestByAccount, fetch) => {
    const current = latestByAccount.get(fetch.accountId);
    if (!current || new Date(fetch.fetchedAt) > new Date(current.fetchedAt)) {
      latestByAccount.set(fetch.accountId, fetch);
    }
    return latestByAccount;
  }, new Map<string, BalanceFetch>());
}

export function getInvestedByAccount(entries: Contribution[] = contributions): Map<string, number> {
  return entries.reduce((totals, contribution) => {
    totals.set(contribution.accountId, (totals.get(contribution.accountId) ?? 0) + contribution.amount);
    return totals;
  }, new Map<string, number>());
}

export function getAccountsWithBalances(data: FinanceData = mockFinanceData): AccountWithBalance[] {
  const latestFetches = getLatestBalanceFetches(data.balanceFetches);
  const investedByAccount = getInvestedByAccount(data.contributions);

  return data.accounts
    .filter((account) => account.isActive)
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((account) => {
      const latestFetch = latestFetches.get(account.id);
      const latestBalance = latestFetch?.balance ?? 0;
      const investedTotal = investedByAccount.get(account.id) ?? 0;
      const growthDollars = latestBalance - investedTotal;
      const growthPercent = investedTotal === 0 ? 0 : (growthDollars / investedTotal) * 100;

      return {
        ...account,
        latestBalance,
        latestFetchedAt: latestFetch?.fetchedAt,
        source: latestFetch?.source,
        investedTotal,
        growthDollars,
        growthPercent
      };
    });
}

export function getDashboardSummary(
  data: FinanceData = mockFinanceData,
  accountRows: AccountWithBalance[] = getAccountsWithBalances(data)
): DashboardSummary {
  const latestPlaidFetch = data.balanceFetches
    .filter((fetch) => fetch.source === "mock_plaid")
    .sort((a, b) => new Date(b.fetchedAt).getTime() - new Date(a.fetchedAt).getTime())[0];

  const netWorthTotal = accountRows.reduce((total, account) => total + account.latestBalance, 0);
  const investedTotal = accountRows.reduce((total, account) => total + account.investedTotal, 0);
  const growthTotal = netWorthTotal - investedTotal;
  const liquidTotal = accountRows
    .filter((account) => account.isLiquid)
    .reduce((total, account) => total + account.latestBalance, 0);
  const nonLiquidTotal = netWorthTotal - liquidTotal;

  return {
    netWorthTotal,
    investedTotal,
    growthTotal,
    growthPercent: investedTotal === 0 ? 0 : (growthTotal / investedTotal) * 100,
    liquidTotal,
    nonLiquidTotal,
    liquidDifference: liquidTotal - nonLiquidTotal,
    lastPlaidSync: latestPlaidFetch?.fetchedAt,
    lastSnapshot: [...data.snapshots].sort(
      (a, b) => new Date(b.snapshotDate).getTime() - new Date(a.snapshotDate).getTime()
    )[0]
  };
}

export function getAnnualReturns(snapshotRows: Snapshot[] = snapshots) {
  const yearEndSnapshots = snapshotRows
    .filter((snapshot) => snapshot.kind === "year_end")
    .sort((a, b) => a.snapshotDate.localeCompare(b.snapshotDate));

  return yearEndSnapshots.map((snapshot) => ({
    year: new Date(snapshot.snapshotDate).getFullYear(),
    investedTotal: snapshot.investedTotal,
    netWorthTotal: snapshot.netWorthTotal,
    growthTotal: snapshot.growthTotal,
    growthPercent: snapshot.investedTotal === 0 ? 0 : (snapshot.growthTotal / snapshot.investedTotal) * 100,
    snapshot
  }));
}

export function basisPointsToPercent(value: number): number {
  return value / 100;
}

export function getAnnualReturnBlocks(data: FinanceData = mockFinanceData): AnnualReturnBlock[] {
  const accountById = new Map(data.accounts.map((account) => [account.id, account]));

  return data.snapshots
    .filter((snapshot) => snapshot.kind === "year_end" || snapshot.yearEndForYear !== undefined)
    .sort((a, b) => {
      const aYear = a.yearEndForYear ?? new Date(a.snapshotDate).getFullYear();
      const bYear = b.yearEndForYear ?? new Date(b.snapshotDate).getFullYear();
      return bYear - aYear;
    })
    .map((snapshot) => {
      const year = snapshot.yearEndForYear ?? new Date(snapshot.snapshotDate).getFullYear();
      const rows = data.snapshotBalances
        .filter((balance) => balance.snapshotId === snapshot.id)
        .reduce<AnnualAccountReturn[]>((annualRows, balance) => {
          const account = accountById.get(balance.accountId);
          if (!account) {
            return annualRows;
          }

          const investedTotal = balance.invested ?? 0;
          const growthDollars = balance.growth ?? balance.balance - investedTotal;
          const growthPercent =
            balance.growthPercentBasisPts === undefined
              ? investedTotal === 0
                ? undefined
                : (growthDollars / investedTotal) * 100
              : basisPointsToPercent(balance.growthPercentBasisPts);

          return [
            ...annualRows,
            {
              account,
              investedTotal,
              growthPercent,
              growthDollars,
              dec31Balance: balance.balance
            }
          ];
        }, [])
        .sort((a, b) => a.account.displayOrder - b.account.displayOrder);

      return {
        year,
        snapshot,
        rows,
        totalInvested: snapshot.investedTotal,
        totalGrowthPercent:
          snapshot.investedTotal === 0 ? 0 : (snapshot.growthTotal / snapshot.investedTotal) * 100,
        totalGrowthDollars: snapshot.growthTotal,
        totalDec31Balance: snapshot.netWorthTotal
      };
    });
}

export function getSnapshotChartPoints(snapshotRows: Snapshot[] = snapshots) {
  return snapshotRows
    .slice()
    .sort((a, b) => a.snapshotDate.localeCompare(b.snapshotDate))
    .map((snapshot) => ({
      date: snapshot.snapshotDate,
      netWorth: snapshot.netWorthTotal,
      invested: snapshot.investedTotal,
      growth: snapshot.growthTotal,
      model: Math.round(snapshot.investedTotal * 1.42)
    }));
}
