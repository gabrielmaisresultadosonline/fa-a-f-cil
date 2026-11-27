#!/usr/bin/env bash
set -euo pipefail
if [[ ${EUID} -ne 0 ]]; then echo 'Execute: sudo bash deploy/install-local-ubuntu.sh'; exit 1; fi
source /etc/os-release
if [[ ${ID:-} != ubuntu || ${VERSION_ID:-} != 24.04 ]]; then echo 'Este instalador requer Ubuntu 24.04 LTS.'; exit 1; fi
USER_NAME=${SUDO_USER:-}
if [[ -z $USER_NAME || $USER_NAME == root ]]; then echo 'Execute com sudo a partir da sua conta normal, não como root.'; exit 1; fi
ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
USER_HOME=$(getent passwd "$USER_NAME" | cut -d: -f6)
test -n "$USER_HOME" && test -f "$ROOT/package.json" || { echo 'Projeto ou conta local inválidos.'; exit 1; }
runuser -u "$USER_NAME" -- test -w "$ROOT" || { echo 'A pasta exportada precisa pertencer à sua conta normal.'; exit 1; }
echo 'Uso apenas na sua máquina de testes: não execute este instalador em uma VPS exposta.'
echo 'Docker pode expor portas e o grupo docker concede privilégios equivalentes a administrador.'
read -rp 'Autoriza instalar Docker e dar esse acesso à sua conta local? Digite LOCAL: ' ANSWER
[[ $ANSWER == LOCAL ]] || { echo 'Instalação cancelada sem mudanças.'; exit 1; }
apt-get update
apt-get install -y docker.io ca-certificates curl unzip ffmpeg
systemctl enable --now docker
usermod -aG docker "$USER_NAME"
STAGING=$(mktemp -d /tmp/motionmro-local-install.XXXXXX)
trap 'rm -rf "$STAGING"' EXIT
chmod 755 "$STAGING"
if ! command -v node >/dev/null || [[ $(node -p 'Number(process.versions.node.split(".")[0])') -lt 22 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x -o "$STAGING/node.sh"
  bash "$STAGING/node.sh"
  apt-get install -y nodejs
fi
if [[ ! -x $USER_HOME/.bun/bin/bun ]]; then
  curl -fsSL https://bun.sh/install -o "$STAGING/bun.sh"
  runuser -u "$USER_NAME" -- env HOME="$USER_HOME" BUN_INSTALL="$USER_HOME/.bun" bash "$STAGING/bun.sh"
fi
BUN_PATH="$USER_HOME/.bun/bin:/usr/local/bin:/usr/bin:/bin"
runuser -u "$USER_NAME" -- env HOME="$USER_HOME" PATH="$BUN_PATH" bash -c 'cd "$1"; bun install; npm --prefix render-server ci; bash deploy/local.sh install' bash "$ROOT"
echo 'Pronto para iniciar: bash deploy/local.sh app'
echo 'Para vídeos, abra outro terminal: bash deploy/local.sh render'
echo 'Reabra o terminal para carregar Bun e as permissões Docker, se necessário.'
