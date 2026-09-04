#!/bin/zsh
set -euo pipefail

readonly ROOT="/Users/vsc_agent/projects/realidi"
readonly PORT="${REALIDI_PORT:-3020}"
readonly HOST="${REALIDI_HOST:-127.0.0.1}"
readonly HEALTH_URL="http://127.0.0.1:3222/version"
readonly NODE_BIN="/Users/vsc_agent/.nvm/versions/node/v22.23.0/bin"
readonly WAIT_SEC=180

export PATH="${NODE_BIN}:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
export HOME="/Users/vsc_agent"
export NODE_ENV="production"
export PORT
cd "$ROOT"

elapsed=0
until curl -fsS --max-time 5 "$HEALTH_URL" >/dev/null 2>&1; do
  if (( elapsed >= WAIT_SEC )); then
    print -r -- "Convex backend not ready on ${HEALTH_URL} after ${WAIT_SEC}s" >&2
    exit 1
  fi
  sleep 2
  (( elapsed += 2 ))
done

if [[ ! -f .next/BUILD_ID ]]; then
  print -r -- "Missing .next/BUILD_ID; run npm run build first" >&2
  exit 1
fi

exec npm start -- --hostname "$HOST" --port "$PORT"
