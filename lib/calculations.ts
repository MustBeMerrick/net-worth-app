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

export type InstitutionBalanceGroup = {
  institution: string;
  accounts: AccountWithBalance[];
  totalBalance: number;
  totalInvested: number;
  totalGrowth: number;
  hasMultipleAccounts: boolean;
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

export function percent(value: number, fractionDigits = 3): string {
  return new Intl.NumberFormat("en-US", {
    style: "percent",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  }).format(value / 100);
}

export function dateLabel(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value));
}

export function dateTimeLabel(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
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

export function getInstitutionBalanceGroups(accountRows: AccountWithBalance[]): InstitutionBalanceGroup[] {
  const groups = accountRows.reduce((groupsByInstitution, account) => {
    const current = groupsByInstitution.get(account.institution) ?? [];
    groupsByInstitution.set(account.institution, [...current, account]);
    return groupsByInstitution;
  }, new Map<string, AccountWithBalance[]>());

  return Array.from(groups.entries()).map(([institution, groupedAccounts]) => {
    const sortedAccounts = groupedAccounts.slice().sort((a, b) => a.displayOrder - b.displayOrder);
    return {
      institution,
      accounts: sortedAccounts,
      totalBalance: sortedAccounts.reduce((total, account) => total + account.latestBalance, 0),
      totalInvested: sortedAccounts.reduce((total, account) => total + account.investedTotal, 0),
      totalGrowth: sortedAccounts.reduce((total, account) => total + account.growthDollars, 0),
      hasMultipleAccounts: sortedAccounts.length > 1
    };
  });
}

export function accountLabel(account: Account): string {
  return account.subaccountName ? `${account.institution} - ${account.subaccountName}` : account.institution;
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
  const activeAccounts = data.accounts.filter((a) => a.isActive).sort((a, b) => a.displayOrder - b.displayOrder);

  const sortByYear = (a: Snapshot, b: Snapshot) => {
    const aYear = a.yearEndForYear ?? new Date(a.snapshotDate).getFullYear();
    const bYear = b.yearEndForYear ?? new Date(b.snapshotDate).getFullYear();
    return aYear - bYear;
  };

  const allYearEndSnapshots = data.snapshots
    .filter((s) => s.kind === "year_end" || s.yearEndForYear !== undefined)
    .sort(sortByYear);

  const visibleYearEndSnapshots = allYearEndSnapshots.filter((s) => s.notes !== "hidden");

  // Map year → snapshot for prev-year lookups (includes hidden anchors)
  const snapshotByYear = new Map<number, Snapshot>(
    allYearEndSnapshots.map((s) => {
      const year = s.yearEndForYear ?? new Date(s.snapshotDate).getFullYear();
      return [year, s];
    })
  );

  return visibleYearEndSnapshots.slice().reverse().map((snapshot) => {
    const year = snapshot.yearEndForYear ?? new Date(snapshot.snapshotDate).getFullYear();

    const prevSnapshot = snapshotByYear.get(year - 1);
    const prevInvestedTotal = prevSnapshot?.investedTotal ?? 0;

    const prevBalanceByAccount = new Map(
      data.snapshotBalances
        .filter((b) => b.snapshotId === prevSnapshot?.id)
        .map((b) => [b.accountId, b])
    );

    const balanceByAccountId = new Map(
      data.snapshotBalances
        .filter((b) => b.snapshotId === snapshot.id)
        .map((b) => [b.accountId, b])
    );

    const prevNetWorth = prevSnapshot?.netWorthTotal ?? 0;
    const yearlyInvestedTotal = snapshot.investedTotal - prevInvestedTotal;
    const totalGrowthDollars = snapshot.netWorthTotal - yearlyInvestedTotal - prevNetWorth;
    const totalGrowthBase = prevNetWorth !== 0 ? prevNetWorth : yearlyInvestedTotal;

    const rows: AnnualAccountReturn[] = activeAccounts.flatMap((account) => {
      const balance = balanceByAccountId.get(account.id);
      if (!balance) return [];
      const cumulativeInvested = balance.invested ?? 0;
      const dec31Balance = balance.balance;
      const prevAcct = prevBalanceByAccount.get(account.id);
      const yearlyInvested = cumulativeInvested - (prevAcct?.invested ?? 0);
      const prevDec31Balance = prevAcct?.balance ?? 0;
      if (yearlyInvested === 0 && dec31Balance === 0) return [];
      const growthDollars = dec31Balance - yearlyInvested - prevDec31Balance;
      const growthBase = prevDec31Balance !== 0 ? prevDec31Balance : yearlyInvested;
      const growthPercent = growthBase === 0 ? undefined : (growthDollars / growthBase) * 100;
      return [{ account, investedTotal: yearlyInvested, growthPercent, growthDollars, dec31Balance }];
    });

    return {
      year,
      snapshot,
      rows,
      totalInvested: yearlyInvestedTotal,
      totalGrowthPercent: totalGrowthBase === 0 ? 0 : (totalGrowthDollars / totalGrowthBase) * 100,
      totalGrowthDollars,
      totalDec31Balance: snapshot.netWorthTotal
    };
  });
}

export type ExponentialFit = {
  a: number;
  b: number;
  annualRate: number;
  startYear: number;
  t0Ms: number;
  r2: number;
} | null;

export function getExponentialFit(snapshotRows: Snapshot[] = snapshots): ExponentialFit {
  const sorted = snapshotRows
    .filter((s) => s.notes !== "hidden")
    .sort((a, b) => a.snapshotDate.localeCompare(b.snapshotDate))
    .filter((s) => s.netWorthTotal > 0);

  if (sorted.length < 2) return null;

  const t0 = new Date(sorted[0].snapshotDate).getTime();
  const msPerYear = 1000 * 60 * 60 * 24 * 365.25;

  const pairs = sorted.map((s) => ({
    t: (new Date(s.snapshotDate).getTime() - t0) / msPerYear,
    lnY: Math.log(s.netWorthTotal)
  }));

  const n = pairs.length;
  const sumT = pairs.reduce((s, p) => s + p.t, 0);
  const sumY = pairs.reduce((s, p) => s + p.lnY, 0);
  const sumTT = pairs.reduce((s, p) => s + p.t * p.t, 0);
  const sumTY = pairs.reduce((s, p) => s + p.t * p.lnY, 0);
  const denom = n * sumTT - sumT * sumT;
  if (denom === 0) return null;

  const b = (n * sumTY - sumT * sumY) / denom;
  const a = Math.exp((sumY - b * sumT) / n);
  const annualRate = Math.exp(b) - 1;
  const startYear = new Date(sorted[0].snapshotDate).getFullYear();

  const meanLnY = sumY / n;
  const ssTot = pairs.reduce((s, p) => s + (p.lnY - meanLnY) ** 2, 0);
  const ssRes = pairs.reduce((s, p) => s + (p.lnY - (Math.log(a) + b * p.t)) ** 2, 0);
  const r2 = ssTot === 0 ? 1 : 1 - ssRes / ssTot;

  return { a, b, annualRate, startYear, t0Ms: t0, r2 };
}

export function getSnapshotChartPoints(snapshotRows: Snapshot[] = snapshots) {
  const sorted = snapshotRows
    .filter((s) => s.notes !== "hidden")
    .sort((a, b) => a.snapshotDate.localeCompare(b.snapshotDate));

  const fit = getExponentialFit(snapshotRows);
  const t0 = fit ? new Date(sorted.find((s) => s.netWorthTotal > 0)!.snapshotDate).getTime() : 0;
  const msPerYear = 1000 * 60 * 60 * 24 * 365.25;

  return sorted.map((snapshot) => {
    const t = (new Date(snapshot.snapshotDate).getTime() - t0) / msPerYear;
    return {
      date: snapshot.snapshotDate,
      netWorth: snapshot.netWorthTotal,
      invested: snapshot.investedTotal,
      growth: snapshot.growthTotal,
      model: fit ? Math.round(fit.a * Math.exp(fit.b * t)) : 0
    };
  });
}
