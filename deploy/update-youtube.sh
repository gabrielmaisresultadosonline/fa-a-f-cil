#!/usr/bin/env bash
# Atualiza somente o downloader e o EJS; não reinstala UVR nem altera dados.
set -euo pipefail
APP_USER=${1:-motionmro}
APP_HOME=$(getent passwd "$APP_USER" | cut -d: -f6)
VENV=${2:-$APP_HOME/.local/share/motionmro/audio-env}
[[ ${EUID} -eq 0 && -n $APP_HOME && -x $VENV/bin/python ]] || { echo 'Ambiente de áudio não encontrado; execute o instalador do MotionMRO.'; exit 1; }
cd "$APP_HOME"
runuser -u "$APP_USER" -- env HOME="$APP_HOME" "$VENV/bin/python" -m pip install --no-cache-dir --upgrade 'yt-dlp[default]'
runuser -u "$APP_USER" -- "$VENV/bin/yt-dlp" --ignore-config --version
runuser -u "$APP_USER" -- node -e 'if(Number(process.versions.node.split(".")[0])<22)process.exit(1)'
echo 'Download do YouTube atualizado com Node e EJS.'