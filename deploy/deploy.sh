#!/usr/bin/env bash
# Deploy control for net-worth-app -> gmktec home server. Run from the Mac.
# Usage: deploy/deploy.sh <init|deploy|db-push|db-pull|logs|status|restart|stop>
set -euo pipefail

HOST="${DEPLOY_HOST:-gmktec}"
ROOT="${DEPLOY_ROOT:-apps/net-worth-app}"   # relative to $HOME on the server
SRC="$ROOT/src"
DATA="$ROOT/data"
COMPOSE="docker compose -f deploy/compose.yml"

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOCAL_DB="$REPO_ROOT/data/net-worth.sqlite"

stamp() { date +%Y%m%d-%H%M%S; }

confirm() {
  read -r -p "$1 [y/N] " reply
  [[ "$reply" == "y" || "$reply" == "Y" ]]
}

cmd_init() {
  ssh "$HOST" "mkdir -p ~/$SRC ~/$DATA"
  if ssh "$HOST" "test -f ~/$ROOT/env"; then
    echo "env file already exists on server -- leaving it alone"
  else
    scp "$REPO_ROOT/deploy/env.example" "$HOST:$ROOT/env"
    echo "uploaded env template -> ~/$ROOT/env  (ssh in and fill real values)"
  fi
  echo "init done: ~/$ROOT/{src,data,env} ready on $HOST"
}

cmd_deploy() {
  cd "$REPO_ROOT"
  if ! git diff-index --quiet HEAD --; then
    echo "warning: uncommitted changes -- deploying committed HEAD only" >&2
  fi
  local tmp
  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' EXIT
  git archive HEAD | tar -x -C "$tmp"
  rsync -az --delete "$tmp"/ "$HOST:$SRC/"
  ssh "$HOST" "set -e; cd ~/$SRC; $COMPOSE build app; $COMPOSE run --rm migrate; $COMPOSE up -d app"
  echo "deployed $(git rev-parse --short HEAD) -> http://gmktec.local:3000"
}

cmd_db_push() {
  [[ -f "$LOCAL_DB" ]] || { echo "no local db at $LOCAL_DB" >&2; exit 1; }
  confirm "Overwrite the SERVER database with your local copy?" || exit 1
  ssh "$HOST" "if [ -f ~/$DATA/net-worth.sqlite ]; then cp ~/$DATA/net-worth.sqlite ~/$DATA/net-worth.sqlite.backup-$(stamp); fi"
  scp "$LOCAL_DB" "$HOST:$DATA/net-worth.sqlite"
  # restart so the app reopens the new file instead of holding the old one
  ssh "$HOST" "cd ~/$SRC 2>/dev/null && $COMPOSE restart app || true"
  echo "local db pushed to server (server copy backed up first)"
}

cmd_db_pull() {
  confirm "Overwrite your LOCAL database with the server copy?" || exit 1
  [[ -f "$LOCAL_DB" ]] && cp "$LOCAL_DB" "$LOCAL_DB.backup-$(stamp)"
  scp "$HOST:$DATA/net-worth.sqlite" "$LOCAL_DB"
  echo "server db pulled to $LOCAL_DB (local copy backed up first)"
}

cmd_logs()    { ssh "$HOST" "cd ~/$SRC && $COMPOSE logs -f --tail=200 app"; }
cmd_status()  { ssh "$HOST" "cd ~/$SRC && $COMPOSE ps"; }
cmd_restart() { ssh "$HOST" "cd ~/$SRC && $COMPOSE restart app"; }
cmd_stop()    { ssh "$HOST" "cd ~/$SRC && $COMPOSE stop app"; }

case "${1:-}" in
  init)     cmd_init ;;
  deploy)   cmd_deploy ;;
  db-push)  cmd_db_push ;;
  db-pull)  cmd_db_pull ;;
  logs)     cmd_logs ;;
  status)   cmd_status ;;
  restart)  cmd_restart ;;
  stop)     cmd_stop ;;
  *) echo "usage: $0 <init|deploy|db-push|db-pull|logs|status|restart|stop>" >&2; exit 1 ;;
esac
