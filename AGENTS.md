# Agent Handoff

This repo is for a private net worth app owned by Marc. A fresh Codex session should treat this file as the project handoff.

## Current State

- Repo path: `/Users/marc/git/net-worth-app`
- Purpose: replace a macOS Numbers spreadsheet with a private web/PWA app.
- Current files are mostly planning docs; no app framework has been scaffolded yet.
- Existing spreadsheet is integrated with Plaid through a Python script, invoked today by an AppleScript/hot-key wrapper.
- The Plaid flow should be reusable outside Numbers, but the script itself has not been copied into this repo yet.
- The user owns `www.mustbemerrick.com` and may host the app under a subdomain such as `app.mustbemerrick.com` or `networth.mustbemerrick.com`.

## Product Summary

Build a private Plaid-backed net worth dashboard that tracks:

- Current account balances.
- Invested capital by account and year.
- Growth dollars and growth percent.
- Year-end / Dec 31 balances.
- Liquid vs non-liquid totals.
- Snapshot history over time.
- Charts for net worth, invested capital, growth, and projection/model line.

The app should preserve the spreadsheet's logic but replace clunky hot-key workflows with explicit buttons:

- Sync Plaid Balances
- Take Snapshot
- Mark Snapshot as Year-End
- Add Contribution
- Edit Account Classification
- Export Backup

## Important Design Decisions Already Made

- Build from scratch because control over workflow and UI is a primary goal.
- Prefer a private web app / PWA over native macOS/iOS first, because it works on desktop and phone.
- Use git from day one.
- Keep this separate from `/Users/marc/git/portfolio-ledger-app`; that repo is a Swift/iOS trade ledger app and should not be repurposed without explicit instruction.
- Do not make brokerage sync the first hard problem; Plaid already exists in Python, so migrate or wrap that logic after the basic app/data model is established.
- Separate latest fetched balances from snapshots. Plaid balances can change; snapshots are historical records chosen by the user.

## Recommended Stack

Unless the user asks otherwise:

- App: Next.js / React PWA.
- Backend: Next.js API routes or a small Node service.
- Database: Postgres for hosted deployment, SQLite acceptable for local prototype.
- ORM/migrations: Prisma or Drizzle.
- Charts: Recharts or ECharts.
- Hosting: Vercel, Fly.io, Render, Railway, or another host that supports server-side code and env vars.
- Domain: subdomain under `mustbemerrick.com`.

## Security Constraints

- Never commit Plaid secrets, access tokens, real balances, CSV exports, Numbers files, local DBs, or backups.
- Use `.env.local` or equivalent for local secrets.
- Use server-side Plaid calls only; never expose Plaid secrets or access tokens to the frontend.
- Require real auth before any hosted deployment.
- Prefer private GitHub repo.

## Suggested First Coding Task

Scaffold the web app and persistence layer, then implement a mocked dashboard before integrating Plaid:

1. Create Next.js app structure in this repo.
2. Add `.gitignore` and `.env.example` if missing.
3. Add database schema for accounts, balance fetches, snapshots, snapshot balances, contributions, and manual adjustments.
4. Build static/mock Dashboard, Accounts, Snapshots, Annual Returns, and Charts routes.
5. Add seed/mock data matching the spreadsheet shape.
6. Add Plaid integration only after the app shell and data model are clear.

Read the docs in `docs/` before making architecture changes.
