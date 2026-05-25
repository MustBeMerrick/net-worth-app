# Architecture

## Recommended Shape

Use a private web app/PWA:

- Works from Mac, iPhone, iPad, and desktop browsers.
- Can be hosted under `mustbemerrick.com`.
- Allows custom buttons and workflows.
- Avoids separate native macOS/iOS codebases for the first version.

## Proposed Stack

- Frontend: Next.js / React.
- Backend: Next.js API routes or small Node service.
- Database: Postgres for hosted deployment; SQLite acceptable for a local prototype.
- ORM: Prisma or Drizzle.
- Charts: Recharts or ECharts.
- Plaid: server-side only, initially reusing/migrating the existing Python script logic.
- Auth: password/passkey or hosted auth before internet deployment.

## Domain/Hosting

Preferred deployment path:

- Private GitHub repo.
- Hosted app on Vercel, Fly.io, Render, Railway, or equivalent.
- Subdomain such as `app.mustbemerrick.com` or `networth.mustbemerrick.com`.
- HTTPS only.

The existing main site at `www.mustbemerrick.com` should not be replaced unless explicitly requested.

## Data Model

Suggested entities:

### Account

- `id`
- `name`
- `institution`
- `subaccount_name`
- `type`
- `subtype`
- `plaid_account_id`
- `is_liquid`
- `is_active`
- `display_order`
- `color`
- `manual_balance`
- `manual_balance_updated_at`
- `notes`
- `created_at`
- `updated_at`

### BalanceSyncRun

Groups balance fetches from a Plaid/manual/import run:

- `id`
- `source`
- `status`
- `started_at`
- `finished_at`
- `error`
- `created_at`

### BalanceFetch

Latest and historical fetched balances from Plaid:

- `id`
- `account_id`
- `sync_run_id`
- `balance`
- `available_balance`
- `currency`
- `source`
- `fetched_at`
- `created_at`

### Snapshot

Historical record chosen by the user:

- `id`
- `snapshot_date`
- `label`
- `kind`
- `year_end_for_year`
- `invested_total`
- `net_worth_total`
- `growth_total`
- `notes`
- `created_at`
- `updated_at`

### SnapshotBalance

Per-account balance inside a snapshot:

- `id`
- `snapshot_id`
- `account_id`
- `balance`
- `invested`
- `growth`
- `growth_percent_basis_points`

### Contribution

Invested capital entry:

- `id`
- `account_id`
- `contribution_date`
- `amount`
- `kind`
- `note`
- `source`
- `year_bucket`
- `created_at`
- `updated_at`

### ManualAdjustment

Explicit correction or non-Plaid value:

- `id`
- `account_id`
- `adjustment_date`
- `amount`
- `reason`
- `created_at`

### ProjectionModel

Optional future support for the spreadsheet's model/projection line:

- `id`
- `name`
- `coefficient`
- `exponential_coefficient`
- `exponent`
- `target_age`
- `created_at`
- `updated_at`

## Calculation Rules

- Latest balance comes from most recent `BalanceFetch` or manual override.
- Snapshot balances are copied values and should not drift.
- Snapshot account rows can store copied invested/growth values so imported spreadsheet history does not have to be perfectly reconstructable from granular contribution rows.
- Total invested is derived from contributions, with any explicit historical adjustments imported from the spreadsheet.
- Growth dollars = net worth - invested capital, scoped by date/account/year as appropriate.
- Growth percent should match the spreadsheet first, then be improved only with explicit approval.
- Year-end balance should come from an official Dec 31 snapshot or a manual year-end override.
- `Snapshot.year_end_for_year` should be unique so only one snapshot is the official record for a year.

## Plaid Flow

Current state:

- Plaid is already integrated through a Python script.
- AppleScript/hot key currently invokes the script for Numbers.

Target state:

1. Move or wrap the Python Plaid sync logic.
2. Store Plaid access tokens server-side only.
3. Fetch balances into `BalanceFetch`.
4. Show fetched balances in Dashboard/Accounts.
5. Let user click `Take Snapshot` to persist official snapshot records.

Do not expose Plaid secrets or access tokens to browser code.
