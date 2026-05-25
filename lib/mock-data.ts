export type AccountType =
  | "brokerage"
  | "retirement"
  | "cash"
  | "hsa"
  | "real_estate"
  | "alternative";

export type Account = {
  id: string;
  name: string;
  institution: string;
  subaccountName?: string;
  type: AccountType;
  subtype: string;
  isLiquid: boolean;
  isActive: boolean;
  displayOrder: number;
  color: string;
  plaidAccountId?: string;
};

export type BalanceFetch = {
  id: string;
  accountId: string;
  balance: number;
  availableBalance?: number;
  currency: "USD";
  source: "plaid" | "mock_plaid" | "manual" | "import";
  fetchedAt: string;
};

export type ContributionKind = "contribution" | "withdrawal" | "import_adjustment";

export type Contribution = {
  id: string;
  accountId: string;
  contributionDate: string;
  amount: number;
  kind?: ContributionKind;
  note?: string;
  source?: string;
};

export type SnapshotKind = "manual" | "plaid_sync" | "year_end" | "import";

export type Snapshot = {
  id: string;
  snapshotDate: string;
  label: string;
  kind: SnapshotKind;
  yearEndForYear?: number;
  investedTotal: number;
  netWorthTotal: number;
  growthTotal: number;
};

export type SnapshotBalance = {
  id: string;
  snapshotId: string;
  accountId: string;
  balance: number;
  invested?: number;
  growth?: number;
  growthPercentBasisPts?: number;
};

export const accounts: Account[] = [
  {
    id: "betterment-taxable",
    name: "Betterment",
    institution: "Betterment",
    subaccountName: "Taxable",
    type: "brokerage",
    subtype: "taxable",
    isLiquid: true,
    isActive: true,
    displayOrder: 1,
    color: "#1d766f",
    plaidAccountId: "mock-betterment-taxable"
  },
  {
    id: "wealthfront-cash",
    name: "Wealthfront",
    institution: "Wealthfront",
    subaccountName: "Cash",
    type: "cash",
    subtype: "cash management",
    isLiquid: true,
    isActive: true,
    displayOrder: 2,
    color: "#5572b8",
    plaidAccountId: "mock-wealthfront-cash"
  },
  {
    id: "fidelity-401k",
    name: "Fidelity",
    institution: "Fidelity",
    subaccountName: "401k",
    type: "retirement",
    subtype: "401k",
    isLiquid: false,
    isActive: true,
    displayOrder: 3,
    color: "#9466a8",
    plaidAccountId: "mock-fidelity-401k"
  },
  {
    id: "vanguard-roth",
    name: "Vanguard",
    institution: "Vanguard",
    subaccountName: "Roth IRA",
    type: "retirement",
    subtype: "roth ira",
    isLiquid: false,
    isActive: true,
    displayOrder: 4,
    color: "#c25746",
    plaidAccountId: "mock-vanguard-roth"
  },
  {
    id: "robinhood-individual",
    name: "Robinhood",
    institution: "Robinhood",
    subaccountName: "Individual",
    type: "brokerage",
    subtype: "taxable",
    isLiquid: true,
    isActive: true,
    displayOrder: 5,
    color: "#d39f33",
    plaidAccountId: "mock-robinhood-individual"
  },
  {
    id: "fundrise",
    name: "Fundrise",
    institution: "Fundrise",
    type: "alternative",
    subtype: "real estate",
    isLiquid: false,
    isActive: true,
    displayOrder: 6,
    color: "#887056"
  },
  {
    id: "hsa",
    name: "HSA",
    institution: "HealthEquity",
    type: "hsa",
    subtype: "health savings",
    isLiquid: false,
    isActive: true,
    displayOrder: 7,
    color: "#4f8b54",
    plaidAccountId: "mock-hsa"
  }
];

export const balanceFetches: BalanceFetch[] = [
  {
    id: "fetch-betterment-taxable-2026-05-25",
    accountId: "betterment-taxable",
    balance: 146280,
    availableBalance: 146280,
    currency: "USD",
    source: "mock_plaid",
    fetchedAt: "2026-05-25T14:20:00-07:00"
  },
  {
    id: "fetch-wealthfront-cash-2026-05-25",
    accountId: "wealthfront-cash",
    balance: 38440,
    availableBalance: 38440,
    currency: "USD",
    source: "mock_plaid",
    fetchedAt: "2026-05-25T14:20:00-07:00"
  },
  {
    id: "fetch-fidelity-401k-2026-05-25",
    accountId: "fidelity-401k",
    balance: 231900,
    currency: "USD",
    source: "mock_plaid",
    fetchedAt: "2026-05-25T14:20:00-07:00"
  },
  {
    id: "fetch-vanguard-roth-2026-05-25",
    accountId: "vanguard-roth",
    balance: 78550,
    currency: "USD",
    source: "mock_plaid",
    fetchedAt: "2026-05-25T14:20:00-07:00"
  },
  {
    id: "fetch-robinhood-individual-2026-05-25",
    accountId: "robinhood-individual",
    balance: 22410,
    availableBalance: 22410,
    currency: "USD",
    source: "mock_plaid",
    fetchedAt: "2026-05-25T14:20:00-07:00"
  },
  {
    id: "fetch-fundrise-2026-05-25",
    accountId: "fundrise",
    balance: 41880,
    currency: "USD",
    source: "manual",
    fetchedAt: "2026-05-25T09:10:00-07:00"
  },
  {
    id: "fetch-hsa-2026-05-25",
    accountId: "hsa",
    balance: 18960,
    currency: "USD",
    source: "mock_plaid",
    fetchedAt: "2026-05-25T14:20:00-07:00"
  }
];

export const contributions: Contribution[] = [
  {
    id: "contrib-2024-01-betterment",
    accountId: "betterment-taxable",
    contributionDate: "2024-01-15",
    amount: 12000,
    note: "Monthly taxable contributions"
  },
  {
    id: "contrib-2024-02-vanguard",
    accountId: "vanguard-roth",
    contributionDate: "2024-02-02",
    amount: 7000,
    note: "Roth IRA annual contribution"
  },
  {
    id: "contrib-2025-01-fidelity",
    accountId: "fidelity-401k",
    contributionDate: "2025-01-17",
    amount: 23000,
    note: "Employee 401k contributions"
  },
  {
    id: "contrib-2025-03-hsa",
    accountId: "hsa",
    contributionDate: "2025-03-03",
    amount: 4300,
    note: "HSA contribution"
  },
  {
    id: "contrib-2026-01-betterment",
    accountId: "betterment-taxable",
    contributionDate: "2026-01-12",
    amount: 15000,
    note: "Taxable savings"
  },
  {
    id: "contrib-2026-02-robinhood",
    accountId: "robinhood-individual",
    contributionDate: "2026-02-14",
    amount: 6000,
    note: "Brokerage contribution"
  }
];

export const snapshots: Snapshot[] = [
  {
    id: "snapshot-2023-12-31",
    snapshotDate: "2023-12-31",
    label: "2023 Year End",
    kind: "year_end",
    investedTotal: 334000,
    netWorthTotal: 412500,
    growthTotal: 78500
  },
  {
    id: "snapshot-2024-06-30",
    snapshotDate: "2024-06-30",
    label: "Mid 2024",
    kind: "manual",
    investedTotal: 353000,
    netWorthTotal: 454200,
    growthTotal: 101200
  },
  {
    id: "snapshot-2024-12-31",
    snapshotDate: "2024-12-31",
    label: "2024 Year End",
    kind: "year_end",
    investedTotal: 368000,
    netWorthTotal: 501800,
    growthTotal: 133800
  },
  {
    id: "snapshot-2025-12-31",
    snapshotDate: "2025-12-31",
    label: "2025 Year End",
    kind: "year_end",
    investedTotal: 395300,
    netWorthTotal: 545900,
    growthTotal: 150600
  },
  {
    id: "snapshot-2026-05-25",
    snapshotDate: "2026-05-25",
    label: "Current Mock Snapshot",
    kind: "plaid_sync",
    investedTotal: 416300,
    netWorthTotal: 578420,
    growthTotal: 162120
  }
];

export const snapshotBalances: SnapshotBalance[] = [
  { id: "sb-2026-betterment", snapshotId: "snapshot-2026-05-25", accountId: "betterment-taxable", balance: 146280 },
  { id: "sb-2026-wealthfront", snapshotId: "snapshot-2026-05-25", accountId: "wealthfront-cash", balance: 38440 },
  { id: "sb-2026-fidelity", snapshotId: "snapshot-2026-05-25", accountId: "fidelity-401k", balance: 231900 },
  { id: "sb-2026-vanguard", snapshotId: "snapshot-2026-05-25", accountId: "vanguard-roth", balance: 78550 },
  { id: "sb-2026-robinhood", snapshotId: "snapshot-2026-05-25", accountId: "robinhood-individual", balance: 22410 },
  { id: "sb-2026-fundrise", snapshotId: "snapshot-2026-05-25", accountId: "fundrise", balance: 41880 },
  { id: "sb-2026-hsa", snapshotId: "snapshot-2026-05-25", accountId: "hsa", balance: 18960 }
];
