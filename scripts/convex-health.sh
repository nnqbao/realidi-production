#!/usr/bin/env bash
set -euo pipefail

curl --fail --silent --show-error http://127.0.0.1:3222/version >/dev/null
curl --fail --silent --show-error http://127.0.0.1:6799/ >/dev/null
curl --fail --silent --show-error http://127.0.0.1:8026/api/v1/info >/dev/null

for port in 3222 3223 6799 1026 8026; do
  if ! lsof -nP -iTCP:"$port" -sTCP:LISTEN | grep -q '127.0.0.1'; then
    printf 'Port %s is not bound to IPv4 loopback.\n' "$port" >&2
    exit 1
  fi
done

printf 'Convex backend, dashboard, and Mailpit are healthy and loopback-bound.\n'
