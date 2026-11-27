#!/usr/bin/env bash
# MotionMRO — instalação/atualização completa em VPS Ubuntu 24.04 ou 26.04 LTS.
# Uso em uma linha:
# curl -fsSL https://raw.githubusercontent.com/gabrielmaisresultadosonline/fa-a-f-cil/main/deploy/vps-install.sh -o /tmp/motionmro-install.sh && sudo bash /tmp/motionmro-install.sh
set -euo pipefail
if [[ ${EUID} -ne 0 ]]; then echo 'Execute com sudo: sudo bash /tmp/motionmro-install.sh'; exit 1; fi
# Roda sempre de uma cópia própria: atualizar o código durante a instalação não pode alterar o script em execução.
if [[ -z ${MRO_INSTALLER_COPY:-} ]]; then
  SELF_COPY=$(mktemp /tmp/motionmro-install.XXXXXX.sh)
  cp "$0" "$SELF_COPY"
  exec env MRO_INSTALLER_COPY=1 bash "$SELF_COPY" "$@"
fi
source /etc/os-release
if [[ ${ID:-} != ubuntu ]] || [[ ! ${VERSION_ID:-} =~ ^(24|26)\.04$ ]]; then echo 'Este instalador requer Ubuntu 24.04 ou 26.04 LTS.'; exit 1; fi

APP_USER=motionmro
APP_HOME=/home/$APP_USER
APP_DIR=$APP_HOME/app
STATE=$APP_HOME/.local/share/motionmro
REPO=https://github.com/gabrielmaisresultadosonline/fa-a-f-cil.git
SUPABASE_BIN=$APP_HOME/.local/bin/supabase
SUPABASE_VERSION=2.65.5
VENV=$STATE/audio-env

echo '== 1/8 Pacotes do sistema =='
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl unzip git docker.io nginx ffmpeg python3 python3-venv build-essential python3-dev ufw iptables \
  libnss3 libatk-bridge2.0-0 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxrandr2 libgbm1 libasound2t64 fonts-liberation
systemctl enable --now docker

echo '== 2/8 Node.js 22 =='
if ! command -v node >/dev/null || [[ $(node -p 'Number(process.versions.node.split(".")[0])' 2>/dev/null || echo 0) -lt 22 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x -o /tmp/motionmro-node-setup.sh
  bash /tmp/motionmro-node-setup.sh
  apt-get install -y nodejs
  rm -f /tmp/motionmro-node-setup.sh
fi

echo '== 3/8 Usuário de serviço e código do GitHub =='
id -u $APP_USER >/dev/null 2>&1 || useradd -m -s /bin/bash $APP_USER
usermod -aG docker $APP_USER
if [[ -d $APP_DIR/.git ]]; then
  runuser -u $APP_USER -- git -C $APP_DIR pull --ff-only
else
  runuser -u $APP_USER -- git clone $REPO $APP_DIR
fi
# O link de download pode entregar uma cópia antiga por alguns minutos; a versão do repositório sempre manda.
if [[ -z ${MRO_INSTALLER_REEXEC:-} ]] && ! cmp -s "$0" "$APP_DIR/deploy/vps-install.sh"; then
  echo 'Usando a versão mais nova do instalador baixada do GitHub...'
  NEW_COPY=$(mktemp /tmp/motionmro-install.XXXXXX.sh)
  cp "$APP_DIR/deploy/vps-install.sh" "$NEW_COPY"
  rm -f "$0"
  exec env MRO_INSTALLER_COPY=1 MRO_INSTALLER_REEXEC=1 bash "$NEW_COPY" "$@"
fi

echo '== 4/8 Bun, backend, yt-dlp e UVR =='
# UVR voice removal needs memory headroom; small VPSs ship without swap and the kernel kills it.
if ! swapon --noheadings --show | grep -q . && [[ ! -e /swapfile ]]; then
  echo "Criando 4 GB de memória extra (swap) para a remoção de voz..."
  (fallocate -l 4G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=4096) && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile \
    && { grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab; } \
    || echo "Aviso: não foi possível criar a swap; músicas longas podem falhar ao remover a voz."
fi
# Somente caches recriáveis; projetos, banco e arquivos de clientes não são tocados.
apt-get clean
rm -rf "$APP_HOME/.cache/pip"
AVAILABLE_KB=$(df -Pk "$APP_HOME" | awk 'NR==2 {print $4}')
MIN_FREE_KB=$((8 * 1024 * 1024))
echo "Espaço livre detectado: $((AVAILABLE_KB / 1024)) MB"
df -h / /tmp "$APP_HOME"
if (( AVAILABLE_KB < MIN_FREE_KB )); then
  echo 'Espaço insuficiente: são necessários pelo menos 8 GB livres; recomendado: 20 GB livres.'
  echo 'Aumente o disco da VPS e execute o mesmo comando novamente. Nenhum dado foi apagado.'
  exit 1
fi
if [[ ! -x $APP_HOME/.bun/bin/bun ]]; then
  runuser -u $APP_USER -- bash -c 'curl -fsSL https://bun.sh/install | bash'
fi
if [[ ! -x $SUPABASE_BIN ]]; then
  install -d -o $APP_USER -g $APP_USER $APP_HOME/.local/bin
  ARCH=$(dpkg --print-architecture)
  case $ARCH in amd64) SB_ARCH=amd64 ;; arm64) SB_ARCH=arm64 ;; *) echo "Arquitetura não suportada: $ARCH"; exit 1 ;; esac
  curl -fsSL "https://github.com/supabase/cli/releases/download/v${SUPABASE_VERSION}/supabase_linux_${SB_ARCH}.tar.gz" -o /tmp/motionmro-supabase.tar.gz
  tar -xzf /tmp/motionmro-supabase.tar.gz -C /tmp supabase
  install -o $APP_USER -g $APP_USER /tmp/supabase $SUPABASE_BIN
  rm -f /tmp/motionmro-supabase.tar.gz /tmp/supabase
fi
install -d -o $APP_USER -g $APP_USER -m 700 $STATE $STATE/uvr-models $STATE/puppeteer $STATE/tmp
export TMPDIR=$STATE/tmp
# Comandos do usuário do app não podem rodar dentro de /root (sem permissão).
cd $APP_HOME
# O UVR exige Python 3.12: versões novas do Ubuntu (ex.: 26.04 com Python 3.14) não têm pacotes prontos.
UV_BIN=$APP_HOME/.local/bin/uv
if [[ ! -x $UV_BIN ]]; then
  install -d -o $APP_USER -g $APP_USER $APP_HOME/.local/bin
  runuser -u $APP_USER -- env UV_INSTALL_DIR=$APP_HOME/.local/bin UV_NO_MODIFY_PATH=1 bash -c 'curl -LsSf https://astral.sh/uv/install.sh | sh'
fi
UV_ENV="HOME=$APP_HOME UV_NO_CONFIG=1 UV_PYTHON_INSTALL_DIR=$STATE/python UV_CACHE_DIR=$STATE/tmp/uv-cache TMPDIR=$STATE/tmp"
if [[ ! -x $VENV/bin/yt-dlp || ! -x $VENV/bin/audio-separator ]] || ! $VENV/bin/python -c 'import sys; sys.exit(sys.version_info[:2] != (3, 12))' 2>/dev/null; then
  rm -rf $VENV
  runuser -u $APP_USER -- env $UV_ENV $UV_BIN venv --seed --python 3.12 $VENV
  runuser -u $APP_USER -- env $UV_ENV $VENV/bin/pip install --no-cache-dir --quiet 'yt-dlp[default]' audioread
  if ! runuser -u $APP_USER -- env $UV_ENV $VENV/bin/pip install --no-cache-dir --quiet 'audio-separator[cpu]>=0.48,<1'; then
    echo 'Aviso: a remoção de voz (UVR) não pôde ser instalada agora; todo o restante continua funcionando.'
    echo 'Execute o mesmo comando depois para tentar instalar novamente.'
  fi
  rm -rf $STATE/tmp/uv-cache
fi

echo '== 5/8 Dependências do app, FFmpeg/HyperFrames e navegador de renderização =='
bash "$APP_DIR/deploy/update-youtube.sh" "$APP_USER" "$VENV"
runuser -u $APP_USER -- bash -c "export PATH=$APP_HOME/.bun/bin:\$PATH && cd $APP_DIR && bun install --frozen-lockfile"
runuser -u $APP_USER -- bash -c "export PUPPETEER_CACHE_DIR=$STATE/puppeteer && cd $APP_DIR/render-server && npm ci --omit=dev && npx --yes puppeteer browsers install chrome && npx --yes hyperframes@0.9.100 --help >/dev/null"

echo '== 6/8 IP público, PostgreSQL e build de produção =='
if [[ -n ${MRO_PUBLIC_IP:-} ]]; then
  PUBLIC_IP=$MRO_PUBLIC_IP
else
  PUBLIC_IP=$(curl -fsS --max-time 10 https://api.ipify.org || curl -fsS --max-time 10 https://ifconfig.me || hostname -I | awk '{print $1}')
fi
PUBLIC_IP=$(python3 -c 'import ipaddress,sys; print(ipaddress.ip_address(sys.argv[1]))' "$PUBLIC_IP")
if [[ $PUBLIC_IP == *:* ]]; then PUBLIC_HOST="[$PUBLIC_IP]"; else PUBLIC_HOST=$PUBLIC_IP; fi
APP_ORIGIN=http://$PUBLIC_HOST
RENDER_ORIGIN=http://$PUBLIC_HOST:4400
echo "Endereço público detectado: $APP_ORIGIN"
echo 'O primeiro download das imagens do banco pode demorar alguns minutos.'
runuser -u $APP_USER -- env SUPABASE_CLI=$SUPABASE_BIN MRO_DEPLOYMENT_MODE=vps MRO_PUBLIC_AUTH_URL=$APP_ORIGIN APP_ORIGIN=$APP_ORIGIN MRO_AUTH_EMAIL_CONFIRMATIONS=false node $APP_DIR/deploy/local.mjs install
runuser -u $APP_USER -- env PATH=$APP_HOME/.bun/bin:/usr/local/bin:/usr/bin:/bin SUPABASE_CLI=$SUPABASE_BIN MRO_DEPLOYMENT_MODE=vps MRO_PUBLIC_AUTH_URL=$APP_ORIGIN APP_ORIGIN=$APP_ORIGIN node $APP_DIR/deploy/local.mjs build

install -d -m 700 /etc/motionmro
cat > /etc/motionmro/app.env <<EOF
PATH=$APP_HOME/.bun/bin:$APP_HOME/.local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
SUPABASE_CLI=$SUPABASE_BIN
MRO_DEPLOYMENT_MODE=vps
MRO_PUBLIC_AUTH_URL=$APP_ORIGIN
APP_HOST=127.0.0.1
APP_PORT=8080
APP_ORIGIN=$APP_ORIGIN
EOF
cat > /etc/motionmro/render.env <<EOF
PATH=$VENV/bin:$APP_HOME/.bun/bin:$APP_HOME/.local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
SUPABASE_CLI=$SUPABASE_BIN
MRO_DEPLOYMENT_MODE=vps
MRO_PUBLIC_AUTH_URL=$APP_ORIGIN
HOST=127.0.0.1
PORT=4401
DATA_DIR=$STATE/renders
PUPPETEER_CACHE_DIR=$STATE/puppeteer
TMPDIR=$STATE/tmp
RENDER_CONCURRENCY=1
MAX_UPLOAD_MB=512
APP_ORIGIN=$APP_ORIGIN
CORS_ORIGINS=$APP_ORIGIN
UVR_MODEL_DIR=$STATE/uvr-models
EOF
chmod 600 /etc/motionmro/app.env /etc/motionmro/render.env

echo '== 7/8 Nginx, serviços permanentes e firewall =='
cat > /etc/nginx/sites-available/motionmro <<'EOF'
map $http_upgrade $motionmro_connection_upgrade {
  default upgrade;
  '' close;
}
server {
  listen 80 default_server;
  listen [::]:80 default_server;
  server_name _;
  server_tokens off;
  client_max_body_size 512m;
  proxy_read_timeout 3600s;
  proxy_send_timeout 3600s;

  location ~ ^/(auth|rest|storage|realtime|functions)/v1/ {
    proxy_pass http://127.0.0.1:54321;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $motionmro_connection_upgrade;
    proxy_read_timeout 3600s;
  }

  location / {
    proxy_pass http://127.0.0.1:8080;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $motionmro_connection_upgrade;
  }
}
server {
  listen 4400;
  listen [::]:4400;
  server_name _;
  server_tokens off;
  client_max_body_size 512m;
  proxy_read_timeout 3600s;
  proxy_send_timeout 3600s;
  proxy_request_buffering off;

  location / {
    proxy_pass http://127.0.0.1:4401;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }
}
EOF
rm -f /etc/nginx/sites-enabled/default
ln -sfn /etc/nginx/sites-available/motionmro /etc/nginx/sites-enabled/motionmro
nginx -t

cat > /usr/local/sbin/motionmro-docker-firewall <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
for tool in /usr/sbin/iptables /usr/sbin/ip6tables; do
  $tool -N DOCKER-USER 2>/dev/null || true
  # Docker published ports bypass UFW; reject backend tools in the forwarding chain.
  $tool -C DOCKER-USER -p tcp -m multiport --dports 54320:54329 -j REJECT 2>/dev/null || \
    $tool -I DOCKER-USER 1 -p tcp -m multiport --dports 54320:54329 -j REJECT
done
EOF
chmod 700 /usr/local/sbin/motionmro-docker-firewall
cat > /etc/systemd/system/motionmro-firewall.service <<EOF
[Unit]
Description=MotionMRO proteção das portas Docker internas
After=docker.service
Requires=docker.service
[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/usr/local/sbin/motionmro-docker-firewall
[Install]
WantedBy=multi-user.target
EOF
cat > /etc/systemd/system/motionmro-db.service <<EOF
[Unit]
Description=MotionMRO PostgreSQL, autenticação e arquivos
After=docker.service motionmro-firewall.service
Requires=docker.service motionmro-firewall.service
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
Description=MotionMRO app em produção
After=motionmro-db.service network-online.target
Requires=motionmro-db.service
Wants=network-online.target
[Service]
User=$APP_USER
Group=docker
WorkingDirectory=$APP_DIR
EnvironmentFile=/etc/motionmro/app.env
ExecStart=/usr/bin/node $APP_DIR/deploy/local.mjs start
Restart=always
RestartSec=5
UMask=0077
LimitNOFILE=65536
[Install]
WantedBy=multi-user.target
EOF
cat > /etc/systemd/system/motionmro-render.service <<EOF
[Unit]
Description=MotionMRO fila de renderização
After=motionmro-db.service network-online.target
Requires=motionmro-db.service
Wants=network-online.target
[Service]
User=$APP_USER
Group=docker
WorkingDirectory=$APP_DIR
EnvironmentFile=/etc/motionmro/render.env
ExecStart=/usr/bin/node $APP_DIR/deploy/local.mjs render
Restart=always
RestartSec=5
UMask=0077
LimitNOFILE=65536
[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now motionmro-firewall
systemctl enable --now motionmro-db
systemctl enable --now motionmro-render motionmro-app
systemctl enable nginx
systemctl restart nginx

ufw default deny incoming >/dev/null
ufw default allow outgoing >/dev/null
ufw allow OpenSSH >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 4400/tcp >/dev/null
ufw delete allow 8080/tcp >/dev/null 2>&1 || true
ufw --force enable >/dev/null

for i in {1..90}; do curl -fsS http://127.0.0.1:4401/ >/dev/null 2>&1 && break; sleep 2; done
for i in {1..90}; do curl -fsS http://127.0.0.1:8080/ >/dev/null 2>&1 && break; sleep 2; done
curl -fsS http://127.0.0.1:4401/ >/dev/null || { echo 'Render não iniciou. Consulte: journalctl -u motionmro-render -e'; exit 1; }
curl -fsS http://127.0.0.1:8080/ >/dev/null || { echo 'App não iniciou. Consulte: journalctl -u motionmro-app -e'; exit 1; }
curl -fsS http://127.0.0.1/ >/dev/null || { echo 'Nginx não respondeu. Consulte: journalctl -u nginx -e'; exit 1; }
curl -fsS http://127.0.0.1:4400/ >/dev/null || { echo 'Acesso público interno ao render falhou. Consulte: nginx -t'; exit 1; }

echo '== 8/8 Conta de administrador e configuração automática =='
ADMIN_EMAIL=${ADMIN_EMAIL:-}
ADMIN_PASSWORD=${MRO_ADMIN_PASSWORD:-}
if [[ -z $ADMIN_EMAIL ]]; then read -r -p 'E-mail do administrador: ' ADMIN_EMAIL; fi
ADMIN_EMAIL=${ADMIN_EMAIL,,}
if [[ ! $ADMIN_EMAIL =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]]; then echo 'E-mail administrativo inválido.'; exit 1; fi
if [[ -z $ADMIN_PASSWORD ]]; then
  read -r -s -p 'Senha do administrador (mínimo 8 caracteres): ' ADMIN_PASSWORD; echo
  read -r -s -p 'Repita a senha: ' ADMIN_PASSWORD_CONFIRM; echo
  [[ $ADMIN_PASSWORD == "$ADMIN_PASSWORD_CONFIRM" ]] || { echo 'As senhas não coincidem.'; exit 1; }
  unset ADMIN_PASSWORD_CONFIRM
fi
[[ ${#ADMIN_PASSWORD} -ge 8 ]] || { echo 'A senha deve ter pelo menos 8 caracteres.'; exit 1; }
printf -v EM '%q' "$ADMIN_EMAIL"
printf '%s\n' "$ADMIN_PASSWORD" | runuser -u $APP_USER -- env SUPABASE_CLI=$SUPABASE_BIN MRO_RENDER_URL=$RENDER_ORIGIN APP_ORIGIN=$APP_ORIGIN bash -c "cd $APP_DIR && node deploy/create-admin.mjs $EM && node deploy/local.mjs admin $EM"
unset ADMIN_PASSWORD MRO_ADMIN_PASSWORD

cat <<EOF

============================================
 MotionMRO instalado e em execução.
 App:        $APP_ORIGIN
 Admin:      $APP_ORIGIN/admin
 Render:     $RENDER_ORIGIN (já configurado)

 O cadastro não exige confirmação de e-mail nesta fase de testes.
 No admin, salve seu token OpenAI antes de gerar vídeos.
 Compras reais continuam desligadas até configurarmos HTTPS e o domínio.

 Logs: journalctl -u motionmro-app -f
       journalctl -u motionmro-render -f
============================================
EOF
