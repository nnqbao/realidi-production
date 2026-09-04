#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
compose=(docker compose -f compose.convex.yml)

case "${1:-}" in
  up)
    "${compose[@]}" up -d --wait
    ;;
  down)
    "${compose[@]}" down
    ;;
  status)
    "${compose[@]}" ps
    ;;
  logs)
    "${compose[@]}" logs --follow
    ;;
  *)
    printf 'Usage: %s {up|down|status|logs}\n' "$0" >&2
    exit 64
    ;;
esac
