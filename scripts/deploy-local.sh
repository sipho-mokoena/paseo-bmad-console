#!/usr/bin/env bash
# Builds the console and installs the build output, and only the build output, into an install
# folder that the Paseo plugin runs. The checkout can then be moved, changed or deleted.
#
#   <install folder>/app/   build output (replaced on every run)
#   <install folder>/.env   your settings (created once, never overwritten)
#
# Usage:  pnpm deploy:local
# Folder: $PASEO_BMAD_CONSOLE_HOME, default ~/.paseo/bmad-console
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="${PASEO_BMAD_CONSOLE_HOME:-$HOME/.paseo/bmad-console}"
STAGE="$ROOT/app.new"
OLD="$ROOT/app.old"

pnpm build

mkdir -p "$ROOT"
rm -rf "$STAGE" "$OLD"
mkdir -p "$STAGE"
cp -a .next/standalone/. "$STAGE"/
# The build copies the checkout's .env into the standalone folder. Settings live next to app/.
rm -f "$STAGE/.env"
# File tracing also leaves a few .ts files in src/lib. The compiled server does not read them.
rm -rf "$STAGE/src/lib"
mkdir -p "$STAGE/.next"
cp -a .next/static "$STAGE/.next/static"
cp -a public "$STAGE/public"

# Swap in one step so a failed copy never leaves a half installed app.
if [ -d "$ROOT/app" ]; then mv "$ROOT/app" "$OLD"; fi
mv "$STAGE" "$ROOT/app"
rm -rf "$OLD"

if [ ! -f "$ROOT/.env" ]; then
  if [ -f .env ]; then
    cp .env "$ROOT/.env"
    echo "Created $ROOT/.env from this checkout's .env. Edit it to change the database or tokens."
  else
    echo "No .env found. Create $ROOT/.env with at least DATABASE_URL (see docs/configuration.md)."
  fi
  [ -f "$ROOT/.env" ] && chmod 600 "$ROOT/.env"
fi

echo "Installed the console in $ROOT/app. Restart it from the BMAD Console screen in Paseo to use the new build."
