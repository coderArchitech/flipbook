#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/common.sh"
compose stop
printf '%s\n' 'Flipbook stopped. Your publications, accounts, and images are preserved.'
