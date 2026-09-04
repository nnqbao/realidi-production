#!/bin/zsh
set -euo pipefail
umask 077

readonly ROOT="/Users/vsc_agent/projects/realidi"
readonly COMPOSE_FILE="${ROOT}/compose.convex.yml"
readonly DOCKER_SOCK="/Users/vsc_agent/.colima/default/docker.sock"
readonly HEALTH_URL="http://127.0.0.1:3222/version"
readonly CHECK_INTERVAL_SEC="${REALIDI_CONVEX_ENSURE_INTERVAL:-20}"
readonly DOCKER_WAIT_SEC=180
readonly HEALTH_WAIT_SEC=90

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
export HOME="/Users/vsc_agent"
export DOCKER_HOST="unix://${DOCKER_SOCK}"

log() { print -r -- "$(date '+%Y-%m-%dT%H:%M:%S%z') $*"; }

docker_ready() { docker info >/dev/null 2>&1; }
backend_healthy() { curl -fsS --max-time 5 "$HEALTH_URL" >/dev/null 2>&1; }

wait_docker() {
  local elapsed=0
  while (( elapsed < DOCKER_WAIT_SEC )); do
    docker_ready && return 0
    sleep 2
    (( elapsed += 2 ))
  done
  return 1
}

wait_backend() {
  local elapsed=0
  while (( elapsed < HEALTH_WAIT_SEC )); do
    backend_healthy && return 0
    sleep 2
    (( elapsed += 2 ))
  done
  return 1
}

ensure_colima() {
  docker_ready && return 0
  if colima status >/dev/null 2>&1; then
    log "docker unavailable; restarting colima"
    colima restart || { colima stop || true; colima start; }
  else
    log "starting colima"
    colima start
  fi
  wait_docker || { log "ERROR: docker not ready"; return 1; }
}

ensure_convex() {
  backend_healthy && return 0
  log "convex backend unhealthy; bringing compose up"
  docker compose -f "$COMPOSE_FILE" up -d --wait
  wait_backend && { log "convex backend healthy"; return 0; }
  log "convex still unhealthy; restarting backend"
  docker compose -f "$COMPOSE_FILE" restart backend || true
  wait_backend && return 0
  log "ERROR: convex backend still unhealthy"
  return 1
}

trap 'log "stopping ensure loop"; exit 0' INT TERM
log "realidi-convex-ensure started interval=${CHECK_INTERVAL_SEC}s"
while true; do
  if ensure_colima; then
    ensure_convex || true
  fi
  sleep "$CHECK_INTERVAL_SEC"
done
