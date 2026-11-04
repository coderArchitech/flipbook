#!/usr/bin/env bash
set -euo pipefail
FLIPBOOK_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$FLIPBOOK_ROOT"
if command -v docker >/dev/null 2>&1; then
  FLIPBOOK_DOCKER="$(command -v docker)"
elif [ -x /Applications/Docker.app/Contents/Resources/bin/docker ]; then
  FLIPBOOK_DOCKER=/Applications/Docker.app/Contents/Resources/bin/docker
  export PATH="/Applications/Docker.app/Contents/Resources/bin:$PATH"
else
  printf '%s\n' 'Docker is missing. Run ./scripts/install.sh first.' >&2
  exit 1
fi
if "$FLIPBOOK_DOCKER" compose version >/dev/null 2>&1; then
  FLIPBOOK_COMPOSE=("$FLIPBOOK_DOCKER" compose)
elif command -v docker-compose >/dev/null 2>&1; then
  FLIPBOOK_COMPOSE=("$(command -v docker-compose)")
elif [ -x /Applications/Docker.app/Contents/Resources/cli-plugins/docker-compose ]; then
  FLIPBOOK_COMPOSE=(/Applications/Docker.app/Contents/Resources/cli-plugins/docker-compose)
elif command -v brew >/dev/null 2>&1 && [ -x "$(brew --prefix)/opt/docker-compose/bin/docker-compose" ]; then
  FLIPBOOK_COMPOSE=("$(brew --prefix)/opt/docker-compose/bin/docker-compose")
else
  printf '%s\n' 'Docker Compose is missing. Run ./scripts/install.sh.' >&2
  exit 1
fi
compose() { "${FLIPBOOK_COMPOSE[@]}" --project-directory "$FLIPBOOK_ROOT" -f "$FLIPBOOK_ROOT/compose.yaml" "$@"; }
require_engine() { "$FLIPBOOK_DOCKER" info >/dev/null 2>&1 || { printf '%s\n' 'Docker is not reachable. Start Docker Desktop or run: colima start --cpu 2 --memory 4' >&2; exit 1; }; }
