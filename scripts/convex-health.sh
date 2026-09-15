#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ -f .env.local ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env.local
  set +a
fi

url="${NEXT_PUBLIC_CONVEX_URL:-}"
site="${NEXT_PUBLIC_CONVEX_SITE_URL:-}"
if [[ -z "$url" || -z "$site" ]]; then
  printf 'Missing NEXT_PUBLIC_CONVEX_URL or NEXT_PUBLIC_CONVEX_SITE_URL.\n' >&2
  exit 1
fi

curl --fail --silent --show-error --max-time 10 "${url%/}/version" >/dev/null \
  || curl --fail --silent --show-error --max-time 10 "$url" >/dev/null
curl --fail --silent --show-error --max-time 10 \
  "${site%/}/.well-known/openid-configuration" >/dev/null

printf 'Convex Cloud backend and auth issuer are healthy.\n'
