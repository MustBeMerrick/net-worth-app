# Deploying to the gmktec home server

The app runs as a Docker container on the gmktec (Ubuntu Server). The SQLite
database lives on the server's disk, *outside* the container, so deploys never
touch data. Everything is driven from the Mac via `deploy/deploy.sh`.

## Server layout

```
~/apps/net-worth-app/
├── src/     # deployed source (rsynced copy of committed HEAD)
├── data/    # net-worth.sqlite + timestamped backups — never touched by deploys
└── env      # runtime secrets (from deploy/env.example) — never in git
```

## One-time setup

1. SSH alias `gmktec` in `~/.ssh/config` (already done).
2. `deploy/deploy.sh init` — creates the folders above, uploads the env template.
3. SSH in and edit `~/apps/net-worth-app/env` (set a real `SESSION_SECRET`).
4. `deploy/deploy.sh deploy` — first build + start (empty DB, schema auto-created).
5. `deploy/deploy.sh db-push` — seed the server with the local database.

## Everyday commands

| Command | Effect |
|---|---|
| `deploy/deploy.sh deploy` | Ship latest **commit**: rsync → build image → `prisma db push` → restart |
| `deploy/deploy.sh db-push` | Local DB → server (backs up server copy, confirms first) |
| `deploy/deploy.sh db-pull` | Server DB → local (backs up local copy, confirms first) |
| `deploy/deploy.sh logs` | Tail app logs |
| `deploy/deploy.sh status` | `docker compose ps` (shows health) |
| `deploy/deploy.sh restart` / `stop` | Restart / stop the container |

Overrides: `DEPLOY_HOST` (default `gmktec`), `DEPLOY_ROOT` (default
`apps/net-worth-app`), `NW_PORT` on the server (default 3000).

## How a deploy works

`deploy` packages the current commit with `git archive` (never the dirty working
tree), rsyncs it to `src/` on the server, then remotely runs:

```
docker compose -f deploy/compose.yml build app        # build image on the server
docker compose -f deploy/compose.yml run --rm migrate # prisma db push against mounted DB
docker compose -f deploy/compose.yml up -d app        # swap in the new container
```

The server needs no GitHub credentials; what's running is always a known commit.

## Which database is "real"?

Whichever machine you're entering data on. Today that's the Mac (`db-push`
after entering data). Once the server becomes the primary, flip to `db-pull`
before any local work. Sync is deliberately manual + confirmed + backed up —
never automatic. Avoid pulling while actively entering data in the server app.

## Security: LAN-only until auth exists

The app has **no authentication** (see AGENTS.md). Do not port-forward or put
it on a public domain yet. Access it at `http://gmktec.local:3000` on the LAN,
or install Tailscale on the server + phone for remote access over a private
tunnel. Revisit `networth.mustbemerrick.com` + HTTPS (Caddy) after real auth.

## Later: auto-deploy on push to master

Install a **self-hosted GitHub Actions runner** on the gmktec (it polls GitHub;
no inbound access or credentials on the server beyond the runner itself). Then:

```yaml
# .github/workflows/deploy.yml (sketch — not active yet)
on: { push: { branches: [master] } }
jobs:
  deploy:
    runs-on: self-hosted
    steps:
      - uses: actions/checkout@v4
      - run: |
          rsync -a --delete ./ ~/apps/net-worth-app/src/
          cd ~/apps/net-worth-app/src
          docker compose -f deploy/compose.yml build app
          docker compose -f deploy/compose.yml run --rm migrate
          docker compose -f deploy/compose.yml up -d app
```

Same steps as `deploy.sh deploy` — only the trigger changes.
