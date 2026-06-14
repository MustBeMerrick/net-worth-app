import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function cents(dollars) {
  const [whole, frac = ""] = dollars.toFixed(2).split(".");
  return BigInt(whole) * 100n + BigInt(frac.padEnd(2, "0"));
}

const ALL_ACCOUNTS = [
  "betterment-extra-money",
  "betterment-ira",
  "wealthfront-cash",
  "fidelity-401k",
  "vanguard-roth",
  "robinhood-individual",
  "robinhood-roth",
  "robinhood-ira",
  "fundrise",
  "lpl-individual",
  "securian",
  "hsa",
];

// balances and invested keyed by accountId; omitted accounts get 0
const snapshots = [
  {
    id: "snap-2016-12-31",
    date: new Date("2016-12-31T12:00:00.000Z"),
    label: "December 31, 2016",
    kind: "year_end",
    yearEndForYear: 2016,
    accounts: {
      "betterment-extra-money": { balance: 39747.35, invested: 37819.02 },
      "fidelity-401k":          { balance: 21632.45, invested: 20305.00 },
      "vanguard-roth":          { balance:  4587.67, invested:   621.44 },
      "robinhood-individual":   { balance:  2550.00, invested:  2232.26 },
    },
  },
  {
    id: "snap-2017-12-31",
    date: new Date("2017-12-31T12:00:00.000Z"),
    label: "December 31, 2017",
    kind: "year_end",
    yearEndForYear: 2017,
    accounts: {
      // invested = 2016 cumulative + 2017 new contributions
      "betterment-extra-money": { balance: 57184.25, invested: 44984.02 }, // 37819.02 + 7165.00
      "fidelity-401k":          { balance: 33125.70, invested: 26719.24 }, // 20305.00 + 6414.24
      "vanguard-roth":          { balance:  5335.77, invested:   621.44 }, // +0
      "robinhood-individual":   { balance:  3535.62, invested:  2232.26 }, // +0
    },
  },
];

for (const snap of snapshots) {
  const balanceRows = ALL_ACCOUNTS.map((accountId) => {
    const row = snap.accounts[accountId] ?? { balance: 0, invested: 0 };
    const balanceCents = cents(row.balance);
    const investedCents = cents(row.invested);
    return { accountId, balanceCents, investedCents, growthCents: balanceCents - investedCents };
  });

  const totalBalance  = balanceRows.reduce((s, r) => s + r.balanceCents,  0n);
  const totalInvested = balanceRows.reduce((s, r) => s + r.investedCents, 0n);
  const totalGrowth   = totalBalance - totalInvested;

  await prisma.snapshot.upsert({
    where: { id: snap.id },
    update: {},
    create: {
      id: snap.id,
      snapshotDate: snap.date,
      label: snap.label,
      kind: snap.kind,
      yearEndForYear: snap.yearEndForYear,
      investedTotalCents: totalInvested,
      netWorthTotalCents: totalBalance,
      growthTotalCents: totalGrowth,
      balances: {
        create: balanceRows.map((r) => ({
          id: `sb-${snap.id}-${r.accountId}`,
          accountId: r.accountId,
          balanceCents: r.balanceCents,
          investedCents: r.investedCents,
          growthCents: r.growthCents,
        })),
      },
    },
  });

  console.log(`Inserted ${snap.label}: balance=$${(Number(totalBalance) / 100).toFixed(2)}, invested=$${(Number(totalInvested) / 100).toFixed(2)}, growth=$${(Number(totalGrowth) / 100).toFixed(2)}`);
}

await prisma.$disconnect();
