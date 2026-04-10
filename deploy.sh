#!/usr/bin/env bash
set -euo pipefail

log() { printf '\n[%s] %s\n' "$(date +'%Y-%m-%d %H:%M:%S')" "$*"; }

# Por si estás en subcarpeta y lo ejecutás desde otro lado
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_ROOT"

log "Repo: $REPO_ROOT"

log "git pull"
git pull

log "docker compose stop"
docker compose stop

log "docker compose build --no-cache"
docker compose build --no-cache

log "docker compose up -d"
docker compose up -d

log "Listo. Estado:"
docker compose ps
