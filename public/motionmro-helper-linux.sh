#!/usr/bin/env bash
set -euo pipefail
for tool in node python3 ffmpeg; do
  command -v "$tool" >/dev/null || { echo "Instale $tool neste computador e tente novamente (Node.js 22+, Python 3.10+, FFmpeg)."; exit 1; }
done
node -e 'if(Number(process.versions.node.split(".")[0])<22)process.exit(1)' || { echo 'Instale Node.js 22 ou mais recente.'; exit 1; }
BASE="$HOME/.local/share/motionmro-helper"
mkdir -p "$BASE"; chmod 700 "$BASE"
cd "$BASE"
[[ -x python/bin/python ]] || python3 -m venv python
python/bin/python -m pip install --no-cache-dir --upgrade 'yt-dlp[default]'
curl -fsSL https://raw.githubusercontent.com/gabrielmaisresultadosonline/fa-a-f-cil/main/public/motionmro-helper.mjs -o helper.mjs
export YTDLP_COMMAND="$BASE/python/bin/yt-dlp"
exec node helper.mjs