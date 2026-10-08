#!/bin/bash
# Fetches the Emeryville schedule page HTML and commits it to git if changed.
# CI handles the Claude AI parsing step — this script only needs a residential IP.
# Scheduled via launchd (Mac background job) to run daily.

set -euo pipefail

NODE="/Users/lnevard/.nvm/versions/node/v24.14.1/bin/node"
GIT="/usr/bin/git"
REPO="/Users/lnevard/pool-finder"
LOG="$HOME/Library/Logs/pool-finder-emeryville.log"

echo "$(date): Starting Emeryville HTML fetch" >> "$LOG"

"$NODE" "$REPO/scrapers/fetch-emeryville-html.mjs" >> "$LOG" 2>&1

cd "$REPO"
"$GIT" add scrapers/.emeryville-raw-page.html
if ! "$GIT" diff --staged --quiet; then
  "$GIT" -c user.name="Pool Finder Bot" \
         -c user.email="github-actions[bot]@users.noreply.github.com" \
         commit -m "Auto-fetch Emeryville page HTML [skip ci]"
  "$GIT" push
  echo "$(date): Committed and pushed updated HTML" >> "$LOG"
else
  echo "$(date): No change to Emeryville page" >> "$LOG"
fi
