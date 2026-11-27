#!/usr/bin/env bash
# Instalação completa da VPS Ubuntu 24.04: banco local (Docker), app e renderização.
# Uso: git clone https://github.com/gabrielmaisresultadosonline/fa-a-f-cil.git && cd fa-a-f-cil && sudo bash deploy/install-vps-ubuntu.sh
set -euo pipefail
if [[ ${EUID} -ne 0 ]]; then echo 'Execute: sudo bash deploy/install-vps-ubuntu.sh'; exit 1; fi
source /etc/os-release
if [[ ${ID:-} != ubuntu || ${VERSION_ID:-} != 24.04 ]]; then echo 'Este instalador requer Ubuntu 24.04 LTS.'; exit 1; fi
USER_NAME=${SUDO_USER:-}
if [[ -z $USER_NAME || $USER_NAME == root ]]; then echo 'Execute com sudo a partir da sua conta normal, não como root.'; exit 1; fi
ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
USER_HOME=$(getent passwd "$USER_NAME" | cut -d: -f6)
test -n "$USER_HOME" && test -f "$ROOT/package.json" || { echo 'Projeto ou conta local inválidos.'; exit 1; }
runuser -u "$USER_NAME" -- test -w "$ROOT" || { echo 'A pasta do projeto precisa pertencer à sua conta normal.'; exit 1; }

printf 'Endereço público do app (ex.: http://IP-DA-VPS:8080): '
read -r APP_ORIGIN
APP_ORIGIN=${APP_ORIGIN:-http://localhost:8080}
[[ $APP_ORIGIN =~ ^https?://[a-zA-Z0-9.:-]+$ ]] || { echo 'Endereço inválido.'; exit 1; }

echo '== 1/6 Pacotes do sistema =='
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl unzip docker.io ffmpeg python3 python3-venv \
  libnss3 libatk-bridge2.0-0 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxrandr2 libgbm1 libasound2t64 fonts-liberation
systemctl enable --now docker
usermod -aG docker "$USER_NAME"

echo '== 2/6 Node.js 22 =='
if ! command -v node >/dev/null || [[ $(node -p 'Number(process.versions.node.split(".")[0])') -lt 22 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

echo '== 3/6 Bun e Supabase CLI =='
if [[ ! -x $USER_HOME/.bun/bin/bun ]]; then
  runuser -u "$USER_NAME" -- bash -c 'curl -fsSL https://bun.sh/install | bash'
fi
SUPABASE_BIN=$USER_HOME/.local/bin/supabase
if [[ ! -x $SUPABASE_BIN ]]; then
  install -d -o "$USER_NAME" -g "$USER_NAME" "$USER_HOME/.local/bin"
  ARCH=$(dpkg --print-architecture)
  case $ARCH in amd64) SB_ARCH=amd64 ;; arm64) SB_ARCH=arm64 ;; *) echo "Arquitetura não suportada: $ARCH"; exit 1 ;; esac
  SB_VERSION=$(curl -fsSL https://api.github.com/repos/supabase/cli/releases/latest | grep -oP '"tag_name":\s*"v\K[^"]+')
  curl -fsSL "https://github.com/supabase/cli/releases/download/v${SB_VERSION}/supabase_linux_${SB_ARCH}.tar.gz" -o /tmp/supabase-cli.tar.gz
  tar -xzf /tmp/supabase-cli.tar.gz -C /tmp supabase
  install -o "$USER_NAME" -g "$USER_NAME" /tmp/supabase "$SUPABASE_BIN"
  rm -f /tmp/supabase-cli.tar.gz /tmp/supabase
fi

echo '== 4/6 Ambiente Python (yt-dlp + UVR) =='
VENV=$USER_HOME/.local/share/motionmro/audio-env
if [[ ! -x $VENV/bin/audio-separator ]]; then
  runuser -u "$USER_NAME" -- python3 -m venv "$VENV"
  runuser -u "$USER_NAME" -- "$VENV/bin/pip" install --quiet 'yt-dlp' 'audio-separator[cpu]>=0.48,<1' audioread
fi
install -d -o "$USER_NAME" -g "$USER_NAME" "$USER_HOME/.local/share/motionmro/uvr-models"

echo '== 5/6 Dependências do app e renderização =='
runuser -u "$USER_NAME" -- bash -c "export PATH=\"$USER_HOME/.bun/bin:\$PATH\" && cd '$ROOT' && bun install"
runuser -u "$USER_NAME" -- bash -c "cd '$ROOT/render-server' && npm ci --omit=dev && npx --yes puppeteer browsers install chrome"

echo '== 6/6 Banco local e serviços =='
runuser -u "$USER_NAME" -- bash -c "export PATH=\"$SUPABASE_BIN:$USER_HOME/.bun/bin:\$PATH\" && export SUPABASE_CLI=\"$SUPABASE_BIN\" && sg docker -c 'cd $ROOT && node deploy/local.mjs install'"

install -d -m 700 /etc/motionmro
cat > /etc/motionmro/app.env <<EOF
PATH=$USER_HOME/.bun/bin:$USER_HOME/.local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
SUPABASE_CLI=$SUPABASE_BIN
APP_HOST=0.0.0.0
APP_PORT=8080
APP_ORIGIN=$APP_ORIGIN
EOF
cat > /etc/motionmro/render.env <<EOF
PATH=$VENV/bin:$USER_HOME/.bun/bin:$USER_HOME/.local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
SUPABASE_CLI=$SUPABASE_BIN
HOST=0.0.0.0
PORT=4400
RENDER_CONCURRENCY=1
APP_ORIGIN=$APP_ORIGIN
CORS_ORIGINS=$APP_ORIGIN
UVR_MODEL_DIR=$USER_HOME/.local/share/motionmro/uvr-models
EOF
chmod 600 /etc/motionmro/app.env /etc/motionmro/render.env

cat > /etc/systemd/system/motionmro-app.service <<EOF
[Unit]
Description=MotionMRO app
After=network-online.target docker.service
Wants=network-online.target
[Service]
User=$USER_NAME
Group=docker
WorkingDirectory=$ROOT
EnvironmentFile=/etc/motionmro/app.env
ExecStart=/usr/bin/env node $ROOT/deploy/local.mjs app
Restart=always
RestartSec=5
[Install]
WantedBy=multi-user.target
EOF
cat > /etc/systemd/system/motionmro-render.service <<EOF
[Unit]
Description=MotionMRO renderização
After=network-online.target docker.service
Wants=network-online.target
[Service]
User=$USER_NAME
Group=docker
WorkingDirectory=$ROOT
EnvironmentFile=/etc/motionmro/render.env
ExecStart=/usr/bin/env node $ROOT/deploy/local.mjs render
Restart=always
RestartSec=5
[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now motionmro-render motionmro-app

for i in {1..60}; do curl -fsS http://127.0.0.1:4400/ >/dev/null 2>&1 && break; sleep 2; done
for i in {1..90}; do curl -fsS http://127.0.0.1:8080/ >/dev/null 2>&1 && break; sleep 2; done
curl -fsS http://127.0.0.1:4400/ >/dev/null || { echo 'Render não iniciou. Consulte: journalctl -u motionmro-render'; exit 1; }
curl -fsS http://127.0.0.1:8080/ >/dev/null || { echo 'App não iniciou. Consulte: journalctl -u motionmro-app'; exit 1; }

echo ''
echo 'Instalação concluída.'
echo "App: $APP_ORIGIN  ·  Render: porta 4400  ·  E-mails de teste: http://localhost:54324"
echo 'Crie sua conta no app, confirme o e-mail e habilite o admin com:'
echo "  sudo -u $USER_NAME bash -c 'cd $ROOT && node deploy/local.mjs admin SEU-EMAIL'"
echo 'Os modelos de separação de voz são baixados na primeira utilização.'
