#!/bin/zsh
set -euo pipefail

readonly ROOT="/Users/vsc_agent/projects/realidi"
readonly PORT="${REALIDI_PORT:-3020}"
readonly HOST="${REALIDI_HOST:-127.0.0.1}"
readonly NODE_BIN="/Users/vsc_agent/.nvm/versions/node/v22.23.4/bin"
readonly WAIT_SEC=180

export PATH="${NODE_BIN}:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
export HOME="/Users/vsc_agent"
export NODE_ENV="production"
export PORT
cd "$ROOT"

if [[ -f "$ROOT/.env.local" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env.local"
  set +a
fi

HEALTH_URL="${NEXT_PUBLIC_CONVEX_URL:?missing NEXT_PUBLIC_CONVEX_URL}"
HEALTH_SITE="${NEXT_PUBLIC_CONVEX_SITE_URL:-}"

convex_ready() {
  curl -fsS --max-time 5 "${HEALTH_URL%/}/version" >/dev/null 2>&1 \
    || curl -fsS --max-time 5 "$HEALTH_URL" >/dev/null 2>&1 \
    || { [[ -n "$HEALTH_SITE" ]] && curl -fsS --max-time 5 "${HEALTH_SITE%/}/.well-known/openid-configuration" >/dev/null 2>&1; }
}

elapsed=0
until convex_ready; do
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
