#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/common.sh"
require_engine
compose up -d --build --wait --wait-timeout 120
printf '%s\n' 'Flipbook is running. Open the localhost port shown below and create your account.'
compose port app 3000
printf '%s\n' 'Default URL: http://localhost:3000' 'Logs: ./scripts/logs.sh    Stop: ./scripts/stop.sh'
