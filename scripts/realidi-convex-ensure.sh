#!/bin/zsh
set -euo pipefail
umask 077

# Realidi's live backend is Convex Cloud. This agent must never start Colima
# or compose.convex.yml — doing so used to call `colima restart` and would
# disrupt every other Docker project on this Mac Mini.
readonly LOG="${REALIDI_CONVEX_ENSURE_LOG:-/Users/vsc_agent/.openclaw/logs/ai.realidi.convex.log}"
mkdir -p "$(dirname "$LOG")"
print -r -- "$(date '+%Y-%m-%dT%H:%M:%S%z') realidi local Convex Docker is retired; live backend is Convex Cloud. Not touching Colima or Docker." >> "$LOG"
exit 0
