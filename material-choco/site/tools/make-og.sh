#!/bin/sh
# Renders og-card.html to ../og.png (1200 by 630) with headless Chrome.
# Run it again when the icon or the Overview capture changes.
set -eu
here="$(cd "$(dirname "$0")" && pwd)"
"${CHROME_BIN:-google-chrome}" --headless=new --no-sandbox --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
  --window-size=1200,630 --virtual-time-budget=4000 --screenshot="$here/../og.png" "file://$here/og-card.html"
