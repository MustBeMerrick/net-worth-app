# Implementation Plan

## Phase 0: Repo And Planning

Status: complete.

- Initialize git repo.
- Add docs for handoff, product spec, architecture, security, and build plan.
- Add `.gitignore` and `.env.example`.
- Keep the repo free of real financial data.

## Phase 1: App Shell With Mock Data

Goal: make the app shape visible without Plaid risk.

Status: in progress.

- Scaffold a Next.js app.
- Add basic styling and responsive layout.
- Add routes:
  - Dashboard
  - Accounts
  - Contributions
  - Snapshots
  - Annual Returns
  - Charts
- Add fake seed/mock data matching the spreadsheet shape.
- Implement derived metrics with tests where practical.

Current scaffold includes mocked routes and derived calculations. Automated unit tests have not been added yet.

## Phase 2: Persistence

Goal: store real structure locally without importing sensitive data into git.

Status: in progress.

- Add database and migrations.
- Add entities for accounts, balance fetches, snapshots, snapshot balances, contributions, and adjustments.
- Add local seed command with fake data.
- Add export/backup command.

Current local persistence uses Prisma with SQLite at ignored path `data/net-worth.sqlite`. The app reads dashboard data from SQLite. Write workflows and export/backup are not implemented yet.

## Phase 3: Spreadsheet Import

Goal: preserve 2015-present history.

- Export relevant Numbers tables to CSV manually.
- Place CSVs in ignored `imports/`.
- Write import scripts that transform CSV rows into database records.
- Validate imported totals against the spreadsheet.
- Do not commit the CSVs.

## Phase 4: Plaid Integration

Goal: replace the AppleScript/hot-key flow.

- Review existing Python Plaid script.
- Decide whether to wrap it or port it to the app backend.
- Store credentials in `.env.local`.
- Fetch latest balances into `BalanceFetch`.
- Add `Sync Plaid Balances` button.
- Add sync status and error handling.

## Phase 5: Snapshot And Year-End Workflows

Goal: reproduce the high-value spreadsheet actions.

- Add `Take Snapshot` button.
- Add `Mark Snapshot as Year-End`.
- Add manual snapshot editing with audit-friendly confirmation.
- Recreate annual return blocks from stored data.
- Validate year totals against spreadsheet screenshots/imports.

## Phase 6: Hosting

Goal: make it available on desktop and phone.

- Add auth.
- Deploy to a private hosted environment.
- Configure `app.mustbemerrick.com` or `networth.mustbemerrick.com`.
- Add encrypted backup/export process.
- Confirm Plaid production/sandbox environment handling.

## Phase 7: Advanced Analytics

Only after core replacement works:

- Projection/model line from existing spreadsheet.
- CAGR.
- IRR/XIRR.
- Account allocation drift.
- Liquid/non-liquid trend.
- FIRE/target-age projections.
