#!/usr/bin/env bash
# Start this computer as a locked patient kiosk (or waiting-room display).
#
#   scripts/start-kiosk-browser.sh https://hospital.local            # patient kiosk
#   scripts/start-kiosk-browser.sh https://hospital.local display    # waiting-room TV
#
# Before first use, enrol the device: open the URL normally, sign in as admin at
# Administration > Kiosks & screens > "Enrol this device". The enrolment stays in this browser profile.
# Also allow camera/microphone for the site once (Chrome site settings) or via enterprise policy.
set -euo pipefail
URL="${1:?Usage: $0 <server-url> [kiosk|display]}"
MODE="${2:-kiosk}"
TARGET="$URL/?mode=$MODE"
[ "$MODE" = "kiosk" ] && TARGET="$TARGET&lock=1"

PROFILE="${KIOSK_PROFILE_DIR:-$HOME/.hospital-os-kiosk}"
FLAGS=(
  --kiosk "$TARGET"
  --user-data-dir="$PROFILE"
  --no-first-run --noerrdialogs --disable-infobars --disable-translate
  --disable-pinch --overscroll-history-navigation=0
  --disable-features=TranslateUI,OverscrollHistoryNavigation
  --kiosk-printing                       # print token slips without a dialog
  --autoplay-policy=no-user-gesture-required   # announcements on the display board
  --check-for-update-interval=31536000
)

for b in google-chrome google-chrome-stable chromium chromium-browser; do
  if command -v "$b" >/dev/null 2>&1; then exec "$b" "${FLAGS[@]}"; fi
done
if [ "$(uname)" = "Darwin" ]; then
  exec open -na "Google Chrome" --args "${FLAGS[@]}"
fi
echo "Google Chrome or Chromium is required." >&2
exit 1
