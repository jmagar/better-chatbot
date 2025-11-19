#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="docker/compose.dev.yml"
PROJECT_NAME="better-chatbot-dev"

usage() {
  cat <<EOF
Usage: ./dev.sh [command]

Commands:
  up       Start dev services (Postgres + Redis) in the background
  down     Stop dev services
  logs     Tail logs from dev services
  ps       Show dev service status

Examples:
  ./dev.sh up
  ./dev.sh logs
EOF
}

if [[ $# -lt 1 ]]; then
  usage
  exit 1
fi

CMD=$1
shift || true

case "$CMD" in
  up)
    docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" up -d "$@"
    ;;
  down)
    docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" down "$@"
    ;;
  logs)
    docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" logs -f "$@"
    ;;
  ps)
    docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" ps "$@"
    ;;
  *)
    usage
    exit 1
    ;;
 esac
