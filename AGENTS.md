# Agent Handoff

This repo is for a private net worth app owned by Marc. A fresh Codex session should treat this file as the project handoff.

## Current State

- Repo path: `/Users/marc/git/net-worth-app`
- Purpose: replace a macOS Numbers spreadsheet with a private web/PWA app.
- A Next.js app shell has been scaffolded with mocked dashboard, account, contribution, snapshot, annual return, and chart routes.
- Local SQLite persistence has been added through Prisma. The local database file is ignored at `data/net-worth.sqlite`.
- Auth, spreadsheet import, and Plaid integration have not been implemented yet.
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

## Local Database

- Prisma schema: `prisma/schema.prisma`
- Local DB URL: `DATABASE_URL=file:../data/net-worth.sqlite`
- Local DB file: `/Users/marc/git/net-worth-app/data/net-worth.sqlite`
- Seed source: fake data in `lib/mock-data.ts`
- Seed command: `npm run db:seed`

## Suggested Next Coding Task

Replace read-only database views with explicit write workflows:

1. Add server actions or API routes for `Add Contribution`.
2. Add `Take Snapshot` using latest balance fetch rows.
3. Add `Mark Snapshot as Year-End`.
4. Add account classification editing.
5. Add backup/export from SQLite data.
6. Add Plaid integration only after the app shell and data model are clear.

Read the docs in `docs/` before making architecture changes.
