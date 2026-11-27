#!/usr/bin/env bash
# Atualiza somente o downloader, o EJS e o provedor de tokens anti-robô; não reinstala UVR nem altera dados.
set -euo pipefail
APP_USER=${1:-motionmro}
APP_HOME=$(getent passwd "$APP_USER" | cut -d: -f6)
VENV=${2:-$APP_HOME/.local/share/motionmro/audio-env}
POT_IMAGE=brainicism/bgutil-ytdlp-pot-provider
POT_NAME=motionmro-youtube-pot
[[ ${EUID} -eq 0 && -n $APP_HOME && -x $VENV/bin/python ]] || { echo 'Ambiente de áudio não encontrado; execute o instalador do MotionMRO.'; exit 1; }
cd "$APP_HOME"
# O plugin bgutil gera tokens PO: sem eles o YouTube costuma bloquear IPs de servidores mesmo com cookies válidos.
runuser -u "$APP_USER" -- env HOME="$APP_HOME" "$VENV/bin/python" -m pip install --no-cache-dir --upgrade 'yt-dlp[default]' bgutil-ytdlp-pot-provider
runuser -u "$APP_USER" -- "$VENV/bin/yt-dlp" --ignore-config --version
runuser -u "$APP_USER" -- node -e 'if(Number(process.versions.node.split(".")[0])<22)process.exit(1)'

# Provedor de tokens só no loopback: nunca fica exposto na internet.
if command -v docker >/dev/null 2>&1; then
  if docker pull --quiet "$POT_IMAGE" >/dev/null; then
    docker rm -f "$POT_NAME" >/dev/null 2>&1 || true
    docker run -d --name "$POT_NAME" --restart unless-stopped --init -p 127.0.0.1:4416:4416 "$POT_IMAGE" >/dev/null
    echo 'Provedor de tokens do YouTube ativo em 127.0.0.1:4416.'
  else
    echo 'Aviso: não foi possível baixar o provedor de tokens do YouTube agora; rode o atualizador de novo mais tarde.'
  fi
else
  echo 'Aviso: Docker não encontrado; o provedor de tokens do YouTube não foi iniciado.'
fi
echo 'Download do YouTube atualizado com Node, EJS e tokens PO.'
