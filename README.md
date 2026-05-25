# Net Worth App

Private Plaid-backed net worth dashboard for tracking account balances, invested capital, snapshots, annual growth, and long-term financial progress.

This app is intended to replace a working macOS Numbers spreadsheet, not become a generic budgeting app. The spreadsheet already tracks current balances, invested capital, annual growth, Dec 31 balances, and net worth over time. The app should preserve that model while adding a better UI, explicit workflow buttons, mobile access, and cleaner long-term data storage.

## Read First

- [AGENTS.md](./AGENTS.md): instructions and context for fresh Codex/AI coding sessions.
- [docs/north-star.md](./docs/north-star.md): product mission and non-goals.
- [docs/product-spec.md](./docs/product-spec.md): spreadsheet-derived requirements and app screens.
- [docs/architecture.md](./docs/architecture.md): proposed stack, data model, and Plaid flow.
- [docs/security.md](./docs/security.md): privacy, secrets, and financial-data rules.
- [docs/implementation-plan.md](./docs/implementation-plan.md): staged build plan.

## Repo Rules

Track source code, schema, migrations, formulas, docs, and safe sample config. Do not track `.env` files, Plaid credentials, access tokens, CSV exports, Numbers files, local databases, backups, or real financial data.
