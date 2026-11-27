#!/usr/bin/env bash
# MotionMRO — instalação completa em VPS Ubuntu 24.04 LTS (execute como root).
# Clona o GitHub, instala banco local (Docker), app (8080) e renderização (4400).
# Uso:
#   curl -fsSL https://raw.githubusercontent.com/gabrielmaisresultadosonline/fa-a-f-cil/main/deploy/vps-install.sh -o vps-install.sh
#   sudo bash vps-install.sh
set -euo pipefail
if [[ ${EUID} -ne 0 ]]; then echo 'Execute como root: sudo bash vps-install.sh'; exit 1; fi
source /etc/os-release
if [[ ${ID:-} != ubuntu || ${VERSION_ID:-} != 24.04 ]]; then echo 'Este instalador requer Ubuntu 24.04 LTS.'; exit 1; fi

APP_USER=motionmro
APP_HOME=/home/$APP_USER
APP_DIR=$APP_HOME/app
STATE=$APP_HOME/.local/share/motionmro
REPO=https://github.com/gabrielmaisresultadosonline/fa-a-f-cil.git
SUPABASE_BIN=$APP_HOME/.local/bin/supabase
VENV=$STATE/audio-env

echo '== 1/8 Pacotes do sistema =='
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl unzip git docker.io ffmpeg python3 python3-venv ufw \
  libnss3 libatk-bridge2.0-0 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxrandr2 libgbm1 libasound2t64 fonts-liberation
systemctl enable --now docker

echo '== 2/8 Node.js 22 =='
if ! command -v node >/dev/null || [[ $(node -p 'Number(process.versions.node.split(".")[0])' 2>/dev/null || echo 0) -lt 22 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

echo '== 3/8 Usuário de serviço e código =='
id -u $APP_USER >/dev/null 2>&1 || useradd -m -s /bin/bash $APP_USER
usermod -aG docker $APP_USER
if [[ -d $APP_DIR/.git ]]; then
  runuser -u $APP_USER -- git -C $APP_DIR pull --ff-only
else
  runuser -u $APP_USER -- git clone $REPO $APP_DIR
fi

echo '== 4/8 Bun, Supabase CLI e Python (yt-dlp + UVR) =='
if [[ ! -x $APP_HOME/.bun/bin/bun ]]; then
  runuser -u $APP_USER -- bash -c 'curl -fsSL https://bun.sh/install | bash'
fi
if [[ ! -x $SUPABASE_BIN ]]; then
  install -d -o $APP_USER -g $APP_USER $APP_HOME/.local/bin
  ARCH=$(dpkg --print-architecture)
  case $ARCH in amd64) SB_ARCH=amd64 ;; arm64) SB_ARCH=arm64 ;; *) echo "Arquitetura não suportada: $ARCH"; exit 1 ;; esac
  SB_VERSION=$(curl -fsSL https://api.github.com/repos/supabase/cli/releases/latest | grep -oP '"tag_name":\s*"v\K[^"]+')
  curl -fsSL "https://github.com/supabase/cli/releases/download/v${SB_VERSION}/supabase_linux_${SB_ARCH}.tar.gz" -o /tmp/supabase-cli.tar.gz
  tar -xzf /tmp/supabase-cli.tar.gz -C /tmp supabase
  install -o $APP_USER -g $APP_USER /tmp/supabase $SUPABASE_BIN
  rm -f /tmp/supabase-cli.tar.gz /tmp/supabase
fi
if [[ ! -x $VENV/bin/audio-separator ]]; then
  runuser -u $APP_USER -- python3 -m venv $VENV
  runuser -u $APP_USER -- $VENV/bin/pip install --quiet 'yt-dlp' 'audio-separator[cpu]>=0.48,<1' audioread
fi
install -d -o $APP_USER -g $APP_USER $STATE/uvr-models

echo '== 5/8 Dependências do app e da renderização =='
runuser -u $APP_USER -- bash -c "export PATH=$APP_HOME/.bun/bin:\$PATH && cd $APP_DIR && bun install"
runuser -u $APP_USER -- bash -c "cd $APP_DIR/render-server && npm ci --omit=dev && npx --yes puppeteer browsers install chrome"

echo '== 6/8 Banco de dados local (PostgreSQL em Docker) =='
echo 'O primeiro download das imagens pode demorar alguns minutos.'
runuser -u $APP_USER -- bash -c "cd $APP_DIR && export SUPABASE_CLI=$SUPABASE_BIN && sg docker -c 'node deploy/local.mjs install'"

PUBLIC_IP=$(curl -fsS --max-time 10 https://api.ipify.org || curl -fsS --max-time 10 https://ifconfig.me || hostname -I | awk '{print $1}')
APP_ORIGIN=http://$PUBLIC_IP:8080
echo "Endereço público detectado: $APP_ORIGIN"

install -d -m 700 /etc/motionmro
cat > /etc/motionmro/app.env <<EOF
PATH=$APP_HOME/.bun/bin:$APP_HOME/.local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
SUPABASE_CLI=$SUPABASE_BIN
APP_HOST=0.0.0.0
APP_PORT=8080
APP_ORIGIN=$APP_ORIGIN
EOF
cat > /etc/motionmro/render.env <<EOF
PATH=$VENV/bin:$APP_HOME/.bun/bin:$APP_HOME/.local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
SUPABASE_CLI=$SUPABASE_BIN
HOST=0.0.0.0
PORT=4400
RENDER_CONCURRENCY=1
APP_ORIGIN=$APP_ORIGIN
CORS_ORIGINS=$APP_ORIGIN,http://localhost:8080,http://127.0.0.1:8080
UVR_MODEL_DIR=$STATE/uvr-models
EOF
chmod 600 /etc/motionmro/app.env /etc/motionmro/render.env

echo '== 7/8 Serviços (systemd) e firewall =='
cat > /etc/systemd/system/motionmro-db.service <<EOF
[Unit]
Description=MotionMRO banco local (Supabase em Docker)
After=docker.service
Requires=docker.service
[Service]
Type=oneshot
RemainAfterExit=yes
User=$APP_USER
Group=docker
Environment=PATH=$APP_HOME/.local/bin:/usr/local/bin:/usr/bin:/bin
ExecStart=$SUPABASE_BIN --workdir $STATE/backend start
[Install]
WantedBy=multi-user.target
EOF
cat > /etc/systemd/system/motionmro-app.service <<EOF
[Unit]
Description=MotionMRO app
After=motionmro-db.service network-online.target
Requires=motionmro-db.service
Wants=network-online.target
[Service]
User=$APP_USER
Group=docker
WorkingDirectory=$APP_DIR
EnvironmentFile=/etc/motionmro/app.env
ExecStart=/usr/bin/env node $APP_DIR/deploy/local.mjs app
Restart=always
RestartSec=5
[Install]
WantedBy=multi-user.target
EOF
cat > /etc/systemd/system/motionmro-render.service <<EOF
[Unit]
Description=MotionMRO renderização
After=motionmro-db.service network-online.target
Requires=motionmro-db.service
Wants=network-online.target
[Service]
User=$APP_USER
Group=docker
WorkingDirectory=$APP_DIR
EnvironmentFile=/etc/motionmro/render.env
ExecStart=/usr/bin/env node $APP_DIR/deploy/local.mjs render
Restart=always
RestartSec=5
[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now motionmro-db motionmro-render motionmro-app
ufw allow OpenSSH >/dev/null
ufw allow 8080/tcp >/dev/null
ufw allow 4400/tcp >/dev/null
ufw --force enable >/dev/null

for i in {1..60}; do curl -fsS http://127.0.0.1:4400/ >/dev/null 2>&1 && break; sleep 2; done
for i in {1..90}; do curl -fsS http://127.0.0.1:8080/ >/dev/null 2>&1 && break; sleep 2; done
curl -fsS http://127.0.0.1:4400/ >/dev/null || { echo 'Render não iniciou. Consulte: journalctl -u motionmro-render -e'; exit 1; }
curl -fsS http://127.0.0.1:8080/ >/dev/null || { echo 'App não iniciou. Consulte: journalctl -u motionmro-app -e'; exit 1; }

echo '== 8/8 Conta de administrador =='
ADMIN_EMAIL=${ADMIN_EMAIL:-}
ADMIN_PASSWORD=${MRO_ADMIN_PASSWORD:-}
if [[ -z $ADMIN_EMAIL ]]; then read -r -p 'E-mail do administrador: ' ADMIN_EMAIL; fi
if [[ -z $ADMIN_PASSWORD ]]; then read -r -s -p 'Senha do administrador: ' ADMIN_PASSWORD; echo; fi
printf -v EM '%q' "$ADMIN_EMAIL"
printf -v PW '%q' "$ADMIN_PASSWORD"
runuser -u $APP_USER -- bash -c "cd $APP_DIR && export SUPABASE_CLI=$SUPABASE_BIN MRO_ADMIN_PASSWORD=$PW && sg docker -c 'node deploy/create-admin.mjs $EM && node deploy/local.mjs admin $EM'"

echo ''
echo '============================================'
echo ' Instalação concluída.'
echo " App:      $APP_ORIGIN"
echo " Render:   http://$PUBLIC_IP:4400"
echo ' E-mails:  http://127.0.0.1:54324 (somente na VPS; confirmação automática já feita para o admin)'
echo ''
echo ' Último passo no app: entre em /admin e configure o servidor de renderização como:'
echo "   http://$PUBLIC_IP:4400"
echo ''
echo ' Logs: journalctl -u motionmro-app -f  ·  journalctl -u motionmro-render -f'
echo '============================================'
