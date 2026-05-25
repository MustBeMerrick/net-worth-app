# Security And Privacy

This project handles sensitive financial metadata. Treat privacy as a core requirement from the beginning.

## Git Rules

Never commit:

- `.env` files.
- Plaid client secret.
- Plaid access tokens.
- Real account balances exported from Plaid or Numbers.
- CSV exports.
- Numbers spreadsheets.
- Local databases.
- Backups.
- Codex transcript/session dumps.

Safe to commit:

- Source code.
- Schema/migrations.
- Docs.
- `.env.example`.
- Mock data with clearly fake values.

## Hosting Rules

- Use HTTPS only.
- Require authentication before exposing the app on the internet.
- Use environment variables for Plaid credentials and session secrets.
- Keep all Plaid calls on the server.
- Do not send Plaid access tokens to the frontend.
- Prefer a private GitHub repo.

## Local Data

Use ignored folders for local data:

- `imports/`
- `exports/`
- `backups/`
- `data/`
- `.codex-sessions/`

If these directories are created, they should remain ignored.

## Auth Baseline

Before public hosting, add at least:

- Login.
- Secure session cookies.
- CSRF protection where relevant.
- Strong `SESSION_SECRET`.
- No unauthenticated API routes that expose balances or snapshots.

Passkeys or a mature auth provider are acceptable later.
