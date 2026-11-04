#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/common.sh"
require_engine
mkdir -p "$FLIPBOOK_ROOT/test-results/docker"
"${FLIPBOOK_COMPOSE[@]}" --project-directory "$FLIPBOOK_ROOT" -f "$FLIPBOOK_ROOT/compose.test.yaml" run --build --rm -T tests
