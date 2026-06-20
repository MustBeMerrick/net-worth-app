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
  createdAt?: string;
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
  growthAdjustment?: number;
  notes?: string;
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
    id: "betterment-extra-money",
    name: "Extra Money",
    institution: "Betterment",
    subaccountName: "Extra Money",
    type: "cash",
    subtype: "cash reserve",
    isLiquid: true,
    isActive: true,
    displayOrder: 1,
    color: "#4472C4",
    plaidAccountId: "mock-betterment-extra-money"
  },
  {
    id: "betterment-ira",
    name: "IRA",
    institution: "Betterment",
    subaccountName: "IRA",
    type: "retirement",
    subtype: "traditional ira",
    isLiquid: false,
    isActive: true,
    displayOrder: 2,
    color: "#4472C4",
    plaidAccountId: "mock-betterment-ira"
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
    displayOrder: 3,
    color: "#7030A0",
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
    displayOrder: 4,
    color: "#00B050",
    plaidAccountId: "mock-fidelity-401k"
  },
  {
    id: "vanguard-roth",
    name: "Vanguard",
    institution: "Vanguard",
    subaccountName: "Roth IRA",
    type: "retirement",
    subtype: "roth ira",
    isLiquid: true,
    isActive: true,
    displayOrder: 5,
    color: "#FF0000",
    plaidAccountId: "mock-vanguard-roth"
  },
  {
    id: "robinhood-individual",
    name: "Individual",
    institution: "Robinhood",
    subaccountName: "Individual",
    type: "brokerage",
    subtype: "taxable",
    isLiquid: true,
    isActive: true,
    displayOrder: 6,
    color: "#92D050",
    plaidAccountId: "mock-robinhood-individual"
  },
  {
    id: "robinhood-roth",
    name: "Roth",
    institution: "Robinhood",
    subaccountName: "Roth",
    type: "retirement",
    subtype: "roth ira",
    isLiquid: false,
    isActive: true,
    displayOrder: 7,
    color: "#92D050",
    plaidAccountId: "mock-robinhood-roth"
  },
  {
    id: "robinhood-ira",
    name: "IRA",
    institution: "Robinhood",
    subaccountName: "IRA",
    type: "retirement",
    subtype: "traditional ira",
    isLiquid: false,
    isActive: true,
    displayOrder: 8,
    color: "#92D050",
    plaidAccountId: "mock-robinhood-ira"
  },
  {
    id: "fundrise",
    name: "Fundrise",
    institution: "Fundrise",
    type: "alternative",
    subtype: "real estate",
    isLiquid: false,
    isActive: true,
    displayOrder: 9,
    color: "#ED7D31"
  },
  {
    id: "hsa",
    name: "HSA",
    institution: "Navia",
    type: "hsa",
    subtype: "health savings",
    isLiquid: false,
    isActive: true,
    displayOrder: 12,
    color: "#FF00FF",
    plaidAccountId: "mock-hsa"
  },
  {
    id: "securian",
    name: "Individual",
    institution: "Securian",
    type: "retirement",
    subtype: "life insurance",
    isLiquid: false,
    isActive: true,
    displayOrder: 11,
    color: "#FFC000",
    plaidAccountId: "mock-securian"
  },
  {
    id: "lpl-individual",
    name: "Individual",
    institution: "LPL",
    type: "brokerage",
    subtype: "individual",
    isLiquid: true,
    isActive: true,
    displayOrder: 10,
    color: "#00B0F0",
    plaidAccountId: "mock-lpl-individual"
  }
];

export const balanceFetches: BalanceFetch[] = [
  {
    id: "fetch-betterment-extra-money-2026-05-25",
    accountId: "betterment-extra-money",
    balance: 129826,
    availableBalance: 129826,
    currency: "USD",
    source: "mock_plaid",
    fetchedAt: "2026-05-25T14:20:00-07:00"
  },
  {
    id: "fetch-betterment-ira-2026-05-25",
    accountId: "betterment-ira",
    balance: 16454,
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
    balance: 12310,
    availableBalance: 12310,
    currency: "USD",
    source: "mock_plaid",
    fetchedAt: "2026-05-25T14:20:00-07:00"
  },
  {
    id: "fetch-robinhood-roth-2026-05-25",
    accountId: "robinhood-roth",
    balance: 6100,
    currency: "USD",
    source: "mock_plaid",
    fetchedAt: "2026-05-25T14:20:00-07:00"
  },
  {
    id: "fetch-robinhood-ira-2026-05-25",
    accountId: "robinhood-ira",
    balance: 4000,
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
  },
  {
    id: "bf-securian-1",
    accountId: "securian",
    balance: 38475,
    currency: "USD",
    source: "mock_plaid",
    fetchedAt: "2026-05-25T14:20:00-07:00"
  },
  {
    id: "bf-lpl-individual-1",
    accountId: "lpl-individual",
    balance: 62345,
    currency: "USD",
    source: "mock_plaid",
    fetchedAt: "2026-05-25T14:20:00-07:00"
  }
];

export const contributions: Contribution[] = [
  {
    id: "contrib-2024-01-betterment",
    accountId: "betterment-extra-money",
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
    accountId: "betterment-extra-money",
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
  { id: "sb-2026-betterment-extra-money", snapshotId: "snapshot-2026-05-25", accountId: "betterment-extra-money", balance: 129826 },
  { id: "sb-2026-betterment-ira", snapshotId: "snapshot-2026-05-25", accountId: "betterment-ira", balance: 16454 },
  { id: "sb-2026-wealthfront", snapshotId: "snapshot-2026-05-25", accountId: "wealthfront-cash", balance: 38440 },
  { id: "sb-2026-fidelity", snapshotId: "snapshot-2026-05-25", accountId: "fidelity-401k", balance: 231900 },
  { id: "sb-2026-vanguard", snapshotId: "snapshot-2026-05-25", accountId: "vanguard-roth", balance: 78550 },
  { id: "sb-2026-robinhood-individual", snapshotId: "snapshot-2026-05-25", accountId: "robinhood-individual", balance: 12310 },
  { id: "sb-2026-robinhood-roth", snapshotId: "snapshot-2026-05-25", accountId: "robinhood-roth", balance: 6100 },
  { id: "sb-2026-robinhood-ira", snapshotId: "snapshot-2026-05-25", accountId: "robinhood-ira", balance: 4000 },
  { id: "sb-2026-fundrise", snapshotId: "snapshot-2026-05-25", accountId: "fundrise", balance: 41880 },
  { id: "sb-2026-hsa", snapshotId: "snapshot-2026-05-25", accountId: "hsa", balance: 18960 }
];
