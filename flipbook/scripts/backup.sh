#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/common.sh"
require_engine
mkdir -p backups
FLIPBOOK_BACKUP="$FLIPBOOK_ROOT/backups/flipbook-$(date +%Y%m%d-%H%M%S).tar.gz"
FLIPBOOK_WAS_RUNNING="$(compose ps --status running -q app)"
restart_app() { if [ -n "$FLIPBOOK_WAS_RUNNING" ]; then compose up -d >/dev/null; fi; }
trap restart_app EXIT
compose stop app
umask 077
compose run --rm -T --no-deps --entrypoint tar app -czf - -C /app/data . > "$FLIPBOOK_BACKUP"
printf 'Consistent local backup saved: %s\n' "$FLIPBOOK_BACKUP"
