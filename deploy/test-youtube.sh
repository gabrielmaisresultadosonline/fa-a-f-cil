#!/usr/bin/env bash
# Diagnóstico do download do YouTube na VPS, usando os mesmos cookies ativos do admin.
# Uso: sudo bash /home/motionmro/app/deploy/test-youtube.sh "https://www.youtube.com/watch?v=..."
# Mostra só nomes de cookies e mensagens do downloader; nunca exibe valores da sessão.
set -euo pipefail
if [[ ${EUID} -ne 0 ]]; then echo 'Execute com sudo.'; exit 1; fi
APP_USER=motionmro
APP_HOME=/home/$APP_USER
APP_DIR=$APP_HOME/app
STATE=$APP_HOME/.local/share/motionmro
URL=${1:-}
[[ -n $URL ]] || { echo 'Uso: sudo bash /home/motionmro/app/deploy/test-youtube.sh "LINK-DO-YOUTUBE"'; exit 1; }
echo "Provedor de tokens: $(docker ps --filter name=motionmro-youtube-pot --format '{{.Status}}' 2>/dev/null || true)"
cd $APP_HOME
runuser -u $APP_USER -- env PATH="$STATE/audio-env/bin:$PATH" DATA_DIR="$STATE/renders" TMPDIR="$STATE/tmp" \
  node "$APP_DIR/deploy/test-youtube.mjs" "$URL"
