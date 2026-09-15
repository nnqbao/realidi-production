#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
compose=(docker compose -p realidi-convex -f compose.convex.yml)

case "${1:-}" in
  up)
    printf 'Realidi local Convex Docker is retired. Live backend is Convex Cloud.\n' >&2
    printf 'Refusing to start compose.convex.yml so other Docker projects stay untouched.\n' >&2
    exit 1
    ;;
  down)
    "${compose[@]}" down
    ;;
  status)
    "${compose[@]}" ps -a
    ;;
  logs)
    "${compose[@]}" logs --follow
    ;;
  *)
    printf 'Usage: %s {up|down|status|logs}\n' "$0" >&2
    exit 64
    ;;
esac
