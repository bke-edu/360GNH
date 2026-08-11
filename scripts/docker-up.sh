#!/usr/bin/env bash
set -euo pipefail

compose_arguments=()
if (($# > 1)); then
  echo "Usage: $0 [path-to-env-file]" >&2
  exit 2
fi

if (($# == 1)); then
  if [[ ! -r "$1" ]]; then
    echo "Environment file is not readable: $1" >&2
    exit 2
  fi
  compose_arguments+=(--env-file "$1")
fi

if [[ -z "${API_TOKEN:-}" ]]; then
  if command -v openssl >/dev/null 2>&1; then
    API_TOKEN="$(openssl rand -hex 32)"
  else
    API_TOKEN="$(node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))")"
  fi
  export API_TOKEN
fi

exec docker compose "${compose_arguments[@]}" up -d --build
