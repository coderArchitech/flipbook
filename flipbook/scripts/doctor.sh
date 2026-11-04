#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/common.sh"
printf 'Platform: %s / %s\n' "$(uname -s)" "$(uname -m)"
"$FLIPBOOK_DOCKER" --version
"${FLIPBOOK_COMPOSE[@]}" version
require_engine
compose config --quiet
compose ps
df -h "$FLIPBOOK_ROOT"
printf '%s\n' 'Configuration is valid. If the app is running, open its localhost URL.'
