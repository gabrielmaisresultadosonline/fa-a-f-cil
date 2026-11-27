#!/usr/bin/env bash
set -euo pipefail
ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
if ! command -v bun >/dev/null || ! command -v bunx >/dev/null; then
  echo 'Instale Bun e Docker antes de continuar. Veja deploy/LOCALHOST.md.' >&2
  exit 1
fi
exec bun "$ROOT/deploy/local.mjs" "$@"
