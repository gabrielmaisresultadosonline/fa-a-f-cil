#!/usr/bin/env bash
# Ativa domínio e HTTPS na VPS já instalada, sem alterar projetos ou arquivos de clientes.
# Uso: sudo bash /home/motionmro/app/deploy/configure-domain.sh motionmro.com.br 189.24.24.252
set -euo pipefail
if [[ ${EUID} -ne 0 ]]; then echo 'Execute com sudo.'; exit 1; fi

APP_USER=motionmro
APP_HOME=/home/$APP_USER
APP_DIR=$APP_HOME/app
STATE=$APP_HOME/.local/share/motionmro
SUPABASE_BIN=$APP_HOME/.local/bin/supabase
DOMAIN=${1:-motionmro.com.br}
DOMAIN=${DOMAIN,,}
PUBLIC_IP=${2:-${MRO_PUBLIC_IP:-}}
APP_ORIGIN=https://$DOMAIN
RENDER_ORIGIN=$APP_ORIGIN/render

[[ -d $APP_DIR/.git && -f /etc/motionmro/app.env && -f /etc/motionmro/render.env ]] || { echo 'Instale o MotionMRO antes de configurar o domínio.'; exit 1; }
[[ $DOMAIN =~ ^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$ ]] || { echo 'Domínio inválido.'; exit 1; }
if [[ -z $PUBLIC_IP ]]; then PUBLIC_IP=$(curl -fsS --max-time 10 https://api.ipify.org); fi
python3 - "$PUBLIC_IP" <<'PY'
import ipaddress, sys
address = ipaddress.ip_address(sys.argv[1])
if not address.is_global: raise SystemExit('Informe o IP público da VPS.')
PY

check_dns() {
  python3 - "$1" "$PUBLIC_IP" <<'PY'
import socket, sys
host, expected = sys.argv[1:]
try:
    found = sorted({item[4][0] for item in socket.getaddrinfo(host, 443, type=socket.SOCK_STREAM)})
except socket.gaierror:
    found = []
if expected not in found:
    print(f'{host}: apontamento ausente ou diferente. Encontrado: {", ".join(found) or "nenhum endereço"}')
    raise SystemExit(1)
print(f'{host}: apontamento confirmado para {expected}.')
PY
}

echo "== 1/5 Conferir DNS de $DOMAIN =="
if ! check_dns "$DOMAIN" || ! check_dns "www.$DOMAIN"; then
  cat <<EOF

Antes de continuar, configure no provedor DNS:
  A  @    $PUBLIC_IP
  A  www  $PUBLIC_IP

Se usar os nameservers hermes.dns-parking.com e artemis.dns-parking.com,
faça a troca no registro do domínio e crie esses registros na Hostinger.
Aguarde a propagação e execute este mesmo comando novamente.
EOF
  exit 1
fi

echo '== 2/5 Preparar autenticação e build para HTTPS =='
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y certbot python3-certbot-nginx
BACKUP=/etc/motionmro/domain-backup-$(date +%Y%m%d%H%M%S)
install -d -m 700 "$BACKUP"
cp -a /etc/motionmro/app.env /etc/motionmro/render.env /etc/nginx/sites-available/motionmro "$BACKUP/"
cd $APP_HOME
BUILD_ENV=(env "PATH=$APP_HOME/.bun/bin:/usr/local/bin:/usr/bin:/bin" "SUPABASE_CLI=$SUPABASE_BIN" "MRO_DEPLOYMENT_MODE=vps" "MRO_PUBLIC_AUTH_URL=$APP_ORIGIN" "APP_ORIGIN=$APP_ORIGIN" "TMPDIR=$STATE/tmp")
runuser -u $APP_USER -- "${BUILD_ENV[@]}" MRO_AUTH_EMAIL_CONFIRMATIONS=false node $APP_DIR/deploy/local.mjs install
runuser -u $APP_USER -- "${BUILD_ENV[@]}" node $APP_DIR/deploy/local.mjs build
runuser -u $APP_USER -- env SUPABASE_CLI=$SUPABASE_BIN node $APP_DIR/deploy/configure-domain.mjs $DOMAIN

echo '== 3/5 Configurar Nginx e renderização no mesmo domínio =='
set_env() {
  python3 - "$1" "$2" "$3" <<'PY'
from pathlib import Path
import sys
path, key, value = Path(sys.argv[1]), sys.argv[2], sys.argv[3]
lines = path.read_text().splitlines()
entry = f'{key}={value}'
for index, line in enumerate(lines):
    if line.startswith(key + '='):
        lines[index] = entry
        break
else:
    lines.append(entry)
path.write_text('\n'.join(lines) + '\n')
PY
}
for file in /etc/motionmro/app.env /etc/motionmro/render.env; do
  set_env "$file" MRO_PUBLIC_AUTH_URL "$APP_ORIGIN"
  set_env "$file" APP_ORIGIN "$APP_ORIGIN"
done
set_env /etc/motionmro/render.env CORS_ORIGINS "$APP_ORIGIN"
chmod 600 /etc/motionmro/app.env /etc/motionmro/render.env

cat > /etc/nginx/sites-available/motionmro <<EOF
map \$http_upgrade \$motionmro_connection_upgrade {
  default upgrade;
  '' close;
}
server {
  listen 80 default_server;
  listen [::]:80 default_server;
  server_name _;
  return 301 https://$DOMAIN\$request_uri;
}
server {
  listen 80;
  listen [::]:80;
  server_name $DOMAIN www.$DOMAIN;
  server_tokens off;
  client_max_body_size 512m;
  proxy_read_timeout 3600s;
  proxy_send_timeout 3600s;

  location ~ ^/(auth|rest|storage|realtime|functions)/v1/ {
    proxy_pass http://127.0.0.1:54321;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection \$motionmro_connection_upgrade;
    proxy_read_timeout 3600s;
  }

  location = /render { return 301 /render/; }
  location /render/ {
    proxy_pass http://127.0.0.1:4401/;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_request_buffering off;
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
  }

  location / {
    proxy_pass http://127.0.0.1:8080;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection \$motionmro_connection_upgrade;
  }
}
EOF
nginx -t

echo '== 4/5 Emitir certificado e ativar HTTPS =='
certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email --redirect --keep-until-expiring
systemctl restart motionmro-app motionmro-render nginx
ufw allow 443/tcp >/dev/null

echo '== 5/5 Conferir o endereço público =='
for i in {1..60}; do curl -fsS "https://$DOMAIN/" >/dev/null 2>&1 && break; sleep 2; done
curl -fsS "https://$DOMAIN/" >/dev/null || { echo "O app não respondeu em $APP_ORIGIN. Backup: $BACKUP"; exit 1; }
curl -fsS "https://$DOMAIN/render/" >/dev/null || { echo "A renderização não respondeu em $RENDER_ORIGIN. Backup: $BACKUP"; exit 1; }
ufw delete allow 4400/tcp >/dev/null 2>&1 || true

cat <<EOF

============================================
 Domínio e HTTPS configurados.
 App:    $APP_ORIGIN
 Admin:  $APP_ORIGIN/admin
 Render: $RENDER_ORIGIN

 Agora o admin também permite enviar cookies.txt pelo navegador com HTTPS.
 Backup da configuração anterior: $BACKUP
============================================
EOF
