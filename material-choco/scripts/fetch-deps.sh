#!/bin/sh
# Fetches every dependency of Material Choco. Needs only Node.js 22 or newer on the PATH.
# Usage: scripts/fetch-deps.sh
set -e
here="$(cd "$(dirname "$0")" && pwd)"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js was not found on the PATH. Install Node.js 22 or newer, then run this again." >&2
  exit 1
fi
exec node "$here/fetch-deps.mjs" "$@"
