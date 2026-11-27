#!/usr/bin/env bash
set -euo pipefail
if [[ ${EUID} -ne 0 ]]; then echo 'Execute: sudo bash deploy/install-ubuntu.sh'; exit 1; fi
source /etc/os-release
if [[ ${ID:-} != ubuntu || ${VERSION_ID:-} != 24.04 ]]; then echo 'Este instalador requer Ubuntu 24.04 LTS.'; exit 1; fi
ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
test -f "$ROOT/render-server/package.json" || { echo 'Execute a partir do projeto completo exportado.'; exit 1; }
printf 'Endereço do aplicativo (localhost para primeiro teste): '
read -r APP_ORIGIN
APP_ORIGIN=${APP_ORIGIN:-http://localhost:8080}
[[ $APP_ORIGIN =~ ^https?://[a-zA-Z0-9.:-]+$ ]] || { echo 'Endereço inválido.'; exit 1; }
AUTH_URL=$(grep '^VITE_SUPABASE_URL=' "$ROOT/.env" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' || true)
AUTH_PUBLISHABLE_KEY=$(grep '^VITE_SUPABASE_PUBLISHABLE_KEY=' "$ROOT/.env" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' || true)
if [[ -z $AUTH_URL ]]; then read -rp 'Endereço público da autenticação do projeto exportado: ' AUTH_URL; fi
if [[ -z $AUTH_PUBLISHABLE_KEY ]]; then read -rp 'Chave publicável do projeto exportado: ' AUTH_PUBLISHABLE_KEY; fi
[[ $AUTH_URL =~ ^https://[a-zA-Z0-9./:-]+$ && $AUTH_PUBLISHABLE_KEY =~ ^[a-zA-Z0-9_.-]+$ ]] || { echo 'Configuração pública inválida.'; exit 1; }
apt-get update
apt-get install -y ca-certificates curl ffmpeg python3 python3-venv python3-pip libnss3 libatk-bridge2.0-0 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxrandr2 libgbm1 libasound2t64 fonts-liberation nginx
if ! command -v node >/dev/null || [[ $(node -p 'Number(process.versions.node.split(".")[0])') -lt 22 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x -o /tmp/motionmro-node-setup.sh
  bash /tmp/motionmro-node-setup.sh
  apt-get install -y nodejs
  rm -f /tmp/motionmro-node-setup.sh
fi
id motionmro >/dev/null 2>&1 || useradd --system --create-home --home-dir /opt/motionmro --shell /usr/sbin/nologin motionmro
install -d -o motionmro -g motionmro /opt/motionmro/render-server /opt/motionmro/data /opt/motionmro/.cache
cp "$ROOT"/render-server/*.mjs "$ROOT/render-server/package.json" "$ROOT/render-server/package-lock.json" /opt/motionmro/render-server/
chown -R motionmro:motionmro /opt/motionmro/render-server
runuser -u motionmro -- env HOME=/opt/motionmro PUPPETEER_CACHE_DIR=/opt/motionmro/.cache bash -c 'cd /opt/motionmro/render-server && npm ci --omit=dev && npx --yes hyperframes@0.9.100 --help >/dev/null'
python3 -m venv /opt/motionmro/audio-env
/opt/motionmro/audio-env/bin/pip install --no-cache-dir 'yt-dlp[default]' 'audio-separator[cpu]>=0.48,<1'
chown -R motionmro:motionmro /opt/motionmro/audio-env /opt/motionmro/.cache
bash "$ROOT/deploy/update-youtube.sh" motionmro /opt/motionmro/audio-env
install -d -m 700 /etc/motionmro
cat > /etc/motionmro/render.env <<EOF
HOST=127.0.0.1
PORT=4400
DATA_DIR=/opt/motionmro/data
RENDER_CONCURRENCY=1
MAX_UPLOAD_MB=512
APP_ORIGIN=$APP_ORIGIN
CORS_ORIGINS=$APP_ORIGIN
AUTH_URL=$AUTH_URL
AUTH_PUBLISHABLE_KEY=$AUTH_PUBLISHABLE_KEY
PUPPETEER_CACHE_DIR=/opt/motionmro/.cache
PATH=/opt/motionmro/audio-env/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
EOF
chmod 600 /etc/motionmro/render.env
cat > /etc/systemd/system/motionmro-render.service <<'EOF'
[Unit]
Description=MotionMRO renderizacao privada e verificacao de pagamentos
After=network-online.target
Wants=network-online.target
[Service]
User=motionmro
Group=motionmro
WorkingDirectory=/opt/motionmro/render-server
EnvironmentFile=/etc/motionmro/render.env
Environment=HOME=/opt/motionmro
ExecStart=/usr/bin/node /opt/motionmro/render-server/server.mjs
Restart=always
RestartSec=5
UMask=0077
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/motionmro
[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now motionmro-render
for i in {1..30}; do if curl -fsS http://127.0.0.1:4400/ >/dev/null; then break; fi; read -t 1 -r </dev/null || true; done
curl -fsS http://127.0.0.1:4400/ >/dev/null || { echo 'Servidor não iniciou. Consulte: journalctl -u motionmro-render'; exit 1; }
echo 'Servidor instalado em http://localhost:4400. Configure esse endereço na Administração.'
echo 'Contas, projetos e pagamentos continuam no Lovable Cloud. Para acesso externo, configure HTTPS antes de abrir portas.'
echo 'Os modelos de separação de áudio podem ser baixados na primeira utilização.'