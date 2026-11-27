#!/usr/bin/env bash
# Importa uma sessão do YouTube sem transmitir o arquivo por HTTP.
# Uso na VPS: sudo bash /home/motionmro/app/deploy/import-youtube-cookies.sh /root/cookies.txt
set -euo pipefail
if [[ ${EUID} -ne 0 ]]; then echo 'Execute com sudo.'; exit 1; fi

APP_USER=motionmro
APP_HOME=/home/$APP_USER
APP_DIR=$APP_HOME/app
STATE=$APP_HOME/.local/share/motionmro
SOURCE=${1:-}

[[ -f $APP_DIR/deploy/import-youtube-cookies.mjs ]] || { echo 'Atualize o MotionMRO antes de importar os cookies.'; exit 1; }
[[ -n $SOURCE && -f $SOURCE ]] || { echo 'Uso: sudo bash /home/motionmro/app/deploy/import-youtube-cookies.sh /caminho/cookies.txt'; exit 1; }
SIZE=$(stat -c %s "$SOURCE")
(( SIZE > 0 && SIZE <= 1024 * 1024 )) || { echo 'O cookies.txt deve ter entre 1 byte e 1 MB.'; exit 1; }
# Mostra quando o arquivo chegou, para saber se é uma exportação nova (nunca o conteúdo).
MODIFIED=$(stat -c %Y "$SOURCE")
AGE_MIN=$(( ($(date +%s) - MODIFIED) / 60 ))
echo "Arquivo recebido em: $(date -d "@$MODIFIED" '+%d/%m/%Y %H:%M') (há $AGE_MIN minutos)."
if (( AGE_MIN > 30 )); then
  echo 'ATENÇÃO: este arquivo é antigo. Se a exportação foi feita agora, o scp não chegou a substituí-lo.'
fi

install -d -o $APP_USER -g $APP_USER -m 700 "$STATE/tmp"
# O root faz uma cópia temporária legível pelo serviço; o conteúdo nunca é exibido.
TEMP=$(mktemp "$STATE/tmp/youtube-import.XXXXXX.txt")
cleanup() { rm -f "$TEMP"; }
trap cleanup EXIT
install -o $APP_USER -g $APP_USER -m 600 "$SOURCE" "$TEMP"
cd $APP_HOME
runuser -u $APP_USER -- env MRO_DATA_DIR="$STATE/renders" node "$APP_DIR/deploy/import-youtube-cookies.mjs" "$TEMP"
rm -f "$TEMP"
trap - EXIT
# Apaga o arquivo enviado: a sessão já está guardada criptografada, e a próxima
# importação obriga um envio novo em vez de reaproveitar uma sessão expirada.
shred -u "$SOURCE" 2>/dev/null || rm -f "$SOURCE"
echo "Arquivo $SOURCE apagado; a sessão fica só na área protegida do servidor."

echo 'Importação concluída. No admin, clique em Consultar status; os cookies já estarão ativos.'
