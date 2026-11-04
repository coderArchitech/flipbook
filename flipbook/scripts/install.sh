#!/usr/bin/env bash
set -euo pipefail
FLIPBOOK_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$FLIPBOOK_ROOT"
printf '%s\n' 'Preparing Flipbook — one app, one local data volume.'
case "$(uname -s)" in
  Darwin)
    if [ -d /Applications/Docker.app ]; then
      printf '%s\n' 'Using the existing Docker Desktop installation.'
      open /Applications/Docker.app
    else
      if ! command -v brew >/dev/null 2>&1; then
        if [ -x /opt/homebrew/bin/brew ]; then eval "$(/opt/homebrew/bin/brew shellenv)";
        elif [ -x /usr/local/bin/brew ]; then eval "$(/usr/local/bin/brew shellenv)";
        else
          printf '%s\n' 'Homebrew is required to install Colima. Its official installer may ask for your macOS password.'
          FLIPBOOK_BREW_INSTALLER="$(mktemp)"
          curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh -o "$FLIPBOOK_BREW_INSTALLER"
          /bin/bash "$FLIPBOOK_BREW_INSTALLER"
          rm -f "$FLIPBOOK_BREW_INSTALLER"
          if [ -x /opt/homebrew/bin/brew ]; then eval "$(/opt/homebrew/bin/brew shellenv)"; else eval "$(/usr/local/bin/brew shellenv)"; fi
        fi
      fi
      brew install colima docker docker-compose
      colima start --cpu 2 --memory 4 --disk 20
    fi
    ;;
  Linux)
    if ! command -v docker >/dev/null 2>&1; then
      . /etc/os-release
      case "$ID" in ubuntu|debian) ;; *) printf '%s\n' 'Install Docker Engine and its Compose plugin for your distribution: https://docs.docker.com/engine/install/'; exit 1;; esac
      printf '%s\n' 'Installing Docker from its signed official package repository. sudo may request your password.'
      sudo apt-get update
      sudo apt-get install -y ca-certificates curl
      sudo install -m 0755 -d /etc/apt/keyrings
      sudo curl -fsSL "https://download.docker.com/linux/$ID/gpg" -o /etc/apt/keyrings/docker.asc
      sudo chmod a+r /etc/apt/keyrings/docker.asc
      printf 'deb [arch=%s signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/%s %s stable\n' "$(dpkg --print-architecture)" "$ID" "${UBUNTU_CODENAME:-$VERSION_CODENAME}" | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
      sudo apt-get update
      sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
      sudo systemctl enable --now docker
    fi
    if ! docker info >/dev/null 2>&1; then
      printf '%s\n' 'Your account needs Docker socket access. Run these commands, then sign out and back in:' "  sudo usermod -aG docker \"$(id -un)\"" '  ./scripts/install.sh'
      exit 1
    fi
    ;;
  *) printf '%s\n' 'Use this script on macOS, Ubuntu, Debian, or Windows through WSL2 with Docker Desktop integration.'; exit 1;;
esac
source "$FLIPBOOK_ROOT/scripts/common.sh"
for FLIPBOOK_ATTEMPT in $(seq 1 90); do
  if "$FLIPBOOK_DOCKER" info >/dev/null 2>&1; then break; fi
  if [ "$FLIPBOOK_ATTEMPT" = 1 ]; then printf '%s\n' 'Waiting for Docker. Complete any first-launch dialog in Docker Desktop.'; fi
  sleep 2
done
require_engine
if [ ! -f .env ]; then cp .env.example .env; fi
compose build
exec "$FLIPBOOK_ROOT/scripts/start.sh"
