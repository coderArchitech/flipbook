#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/common.sh"
compose logs --tail=100 -f app
