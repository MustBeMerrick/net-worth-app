# North Star

## Mission

Build a private, fast, intentional net worth app that replaces a working Numbers spreadsheet while preserving what made the spreadsheet useful: clear separation of invested capital, account balances, snapshots, annual growth, and long-term progress.

The app should feel like a personal finance command center, not a generic budget tracker.

## Why Build This

The current spreadsheet works but depends on Numbers layout, hot keys, AppleScript, and manual table management. The user wants complete control over buttons and functionality, including direct actions for balance sync, snapshots, year-end records, and contribution tracking.

## Product Principles

- Preserve the spreadsheet's financial logic before improving it.
- Make user intent explicit through buttons and workflows.
- Treat snapshots as historical records, not recalculated views.
- Keep Plaid ingestion separate from reporting calculations.
- Prefer boring, inspectable data structures over clever abstractions.
- Support desktop and phone from the beginning.
- Make import/export and backups first-class so the user is never locked in.

## Non-Goals

- Do not build a generic budgeting app.
- Do not build a full Monarch/Mint clone.
- Do not implement broker trading.
- Do not expose real financial data publicly.
- Do not require automatic Plaid sync for the first useful version.
- Do not merge this app into the existing `portfolio-ledger-app` unless explicitly requested.
