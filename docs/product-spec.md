# Product Spec

## Source Spreadsheet

The current Numbers spreadsheet has two visible tabs:

- `Net Worth`
- `Net Worth Vs. Time`

The spreadsheet includes:

- Current balances by account.
- Account allocation pie chart.
- Net worth total.
- Liquid total.
- Non-liquid total.
- Difference between liquid and non-liquid.
- To-date performance by account.
- Annual performance blocks by year, with account rows and a total row.
- Snapshot table over time with date, invested, net worth, and growth.
- Long-term chart with net worth, invested capital, growth, and a model/projection line.
- A small calculation panel with age, date at age, model coefficients, and projected net worth at target age.

## Accounts Seen In Spreadsheet

The screenshots include accounts/institutions such as:

- Betterment
- Wealthfront
- Fidelity
- Vanguard
- Robinhood
- Fundrise
- LPL
- Securian
- HSA
- Paychex
- eTrade
- Kestra

Some institutions have subaccounts, for example Robinhood individual/Roth/IRA and Betterment extra money/IRA.

## Core Screens

### Dashboard

Show the current state:

- Net worth.
- Total invested.
- Total growth dollars.
- Total growth percent.
- Liquid total.
- Non-liquid total.
- Liquid/non-liquid difference.
- Current balances by account.
- Account allocation chart.
- Last Plaid sync timestamp.
- Last snapshot timestamp.

Primary actions:

- Sync Plaid Balances.
- Take Snapshot.
- Add Contribution.
- Export Backup.

### Accounts

Manage account metadata:

- Account name.
- Institution.
- Optional subaccount name.
- Type/subtype.
- Plaid account id.
- Liquid/non-liquid classification.
- Active/inactive status.
- Manual balance override.
- Display order and chart color.

### Contributions

Record invested capital:

- Date.
- Account.
- Amount.
- Note/source.
- Optional year bucket.

Contributions are not growth. They represent capital added by the user.

### Snapshots

Store explicit historical records:

- Date.
- Label.
- Kind: manual, Plaid sync, year-end, import.
- Invested total at that date.
- Net worth at that date.
- Growth at that date.
- Per-account balances.

Snapshots should be editable only through explicit user actions.

### Annual Returns

Recreate the spreadsheet's year blocks:

- Year.
- Account.
- Total invested.
- Total growth percent.
- Total growth dollars.
- Dec 31 balance.
- Total row for the year.

The user currently tracks this from 2015 onward.

### Charts

Recreate and improve the `Net Worth Vs. Time` tab:

- Net worth line.
- Invested capital line.
- Growth line.
- Optional model/projection line.
- Date range controls.
- Hover details.
- Year markers.

## Key Workflows

### Sync Plaid Balances

Runs the Plaid-backed balance fetch and updates latest fetched balances. This should not automatically rewrite historical snapshots.

### Take Snapshot

Copies latest balances and current invested total into a new snapshot row for the selected date.

### Mark Snapshot as Year-End

Marks a snapshot as the official Dec 31/year-end record for annual performance.

### Add Contribution

Adds invested capital to a specific account and date. This updates invested totals and derived growth calculations.

### Import Historical Spreadsheet Data

Import CSV exports from Numbers to preserve 2015-present history. This is likely needed before the app can fully replace the spreadsheet.
