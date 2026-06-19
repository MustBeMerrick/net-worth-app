# Net Worth App

A personal net worth dashboard PWA for tracking account balances, invested capital, contributions, year-end snapshots, annual growth, and long-term financial progress. Built to replace a macOS Numbers spreadsheet.

## Features

- **Dashboard** — current balances across all accounts, split by liquid vs non-liquid
- **Accounts** — per-account invested capital, balance, and growth with inline balance editing
- **Contributions** — log deposits and withdrawals by account and date; filterable table with undo
- **Snapshots** — manual point-in-time net worth records; mark any snapshot as an official year-end
- **Annual Returns** — year-by-year growth blocks with per-account and institution subtotals; historical institution name renames supported
- **Charts** — net worth, invested capital, growth, and model/projection line over time

## Stack

- **Next.js 16 / React 19** — app router, server components, server actions
- **Prisma + SQLite** — local database at `data/net-worth.sqlite` (git-ignored)
- **TypeScript** — throughout the app
- **Python scripts** — offline PDF parsers for importing brokerage statements (Betterment, Fidelity, Robinhood, Wealthfront)

## Local Development

```bash
npm install
npm run db:generate
npm run db:push
npm run db:seed
npm run dev
```

App runs at `http://localhost:3000`.

```bash
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit
npm run build       # production build
npm run db:studio   # Prisma Studio (DB browser)
```

## PDF Import Scripts

Python scripts in `scripts/` parse brokerage statement PDFs to extract deposits and withdrawals:

```bash
pip install pdfplumber
python3 scripts/parse-robinhood-pdf.py statement.pdf
python3 scripts/parse-betterment-pdf.py statement.pdf
python3 scripts/parse-wealthfront-statements.py statement.pdf
python3 scripts/parse-fidelity-pdf.py statement.pdf
```

Each script prints parsed transactions to stderr and optionally writes a CSV via `--output`.

## Data Model

- **Account** — institution, subaccount name, liquid/non-liquid classification
- **BalanceFetch** — timestamped balance records (latest = current balance shown in UI)
- **Contribution** — individual deposits/withdrawals with date and note
- **Snapshot** — point-in-time net worth record with per-account `SnapshotBalance` rows
- `Snapshot.yearEndForYear` is unique — one official Dec 31 record per year

## Repo Rules

Do not commit `.env` files, Plaid credentials, access tokens, CSV exports, local databases, or real financial data. See `.gitignore`.
