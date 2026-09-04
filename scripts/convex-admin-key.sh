#!/usr/bin/env bash
set -euo pipefail
umask 077

cd "$(dirname "$0")/.."
env_file=".env.local"
tmp_file="$(mktemp "${TMPDIR:-/tmp}/realidi-env.XXXXXX")"
trap 'rm -f "$tmp_file"' EXIT

admin_key="$(docker compose -f compose.convex.yml exec -T backend ./generate_admin_key.sh)"
if [[ -z "$admin_key" || "$admin_key" == *$'\n'* ]]; then
  printf 'Convex admin-key generation returned an invalid value.\n' >&2
  exit 1
fi

if [[ -f "$env_file" ]]; then
  awk '!/^CONVEX_SELF_HOSTED_ADMIN_KEY=/' "$env_file" > "$tmp_file"
fi
printf 'CONVEX_SELF_HOSTED_ADMIN_KEY=%s\n' "$admin_key" >> "$tmp_file"
install -m 600 "$tmp_file" "$env_file"
printf 'Updated %s with mode 0600.\n' "$env_file"
