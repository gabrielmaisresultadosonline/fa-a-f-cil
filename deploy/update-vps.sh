#!/usr/bin/env bash
# MotionMRO — atualiza a VPS com o código mais novo do GitHub e reinicia os serviços.
# Uso: sudo bash /home/motionmro/app/deploy/update-vps.sh
set -euo pipefail
if [[ ${EUID} -ne 0 ]]; then echo 'Execute com sudo: sudo bash /home/motionmro/app/deploy/update-vps.sh'; exit 1; fi
# Roda sempre de uma cópia própria: o git pull pode trocar este arquivo durante a execução.
if [[ -z ${MRO_UPDATE_COPY:-} ]]; then
  SELF_COPY=$(mktemp /tmp/motionmro-update.XXXXXX.sh)
  cp "$0" "$SELF_COPY"
  exec env MRO_UPDATE_COPY=1 bash "$SELF_COPY" "$@"
fi

APP_USER=motionmro
APP_HOME=/home/$APP_USER
APP_DIR=$APP_HOME/app
STATE=$APP_HOME/.local/share/motionmro
ENV_FILE=/etc/motionmro/app.env

[[ -d $APP_DIR/.git ]] || { echo "MotionMRO não encontrado em $APP_DIR. Instale primeiro: deploy/vps-install.sh"; exit 1; }
[[ -f $ENV_FILE ]] || { echo "Configuração $ENV_FILE não encontrada. Instale primeiro: deploy/vps-install.sh"; exit 1; }
# Comandos da conta do app nunca rodam dentro de /root (sem permissão).
cd $APP_HOME

# As chaves privilegiadas ficam apenas nos processos de servidor; nada é exibido.
set -a
. $ENV_FILE
set +a
BUILD_ENV=(env "PATH=$PATH" "SUPABASE_CLI=${SUPABASE_CLI:-$APP_HOME/.local/bin/supabase}" "MRO_DEPLOYMENT_MODE=vps" "MRO_PUBLIC_AUTH_URL=${MRO_PUBLIC_AUTH_URL:-}" "APP_ORIGIN=${APP_ORIGIN:-}" "TMPDIR=$STATE/tmp")

echo '== 1/4 Código mais novo do GitHub =='
BEFORE=${MRO_UPDATE_BEFORE:-$(runuser -u $APP_USER -- git -C $APP_DIR rev-parse HEAD)}
runuser -u $APP_USER -- git -C $APP_DIR fetch origin main
if ! runuser -u $APP_USER -- git -C $APP_DIR merge --ff-only origin/main; then
  echo 'Havia alterações locais no código da VPS; elas serão descartadas para usar a versão do GitHub.'
  runuser -u $APP_USER -- git -C $APP_DIR checkout -- .
  runuser -u $APP_USER -- git -C $APP_DIR merge --ff-only origin/main
fi
AFTER=$(runuser -u $APP_USER -- git -C $APP_DIR rev-parse HEAD)
# A versão já instalada pode não conhecer novas etapas de atualização.
if [[ -z ${MRO_UPDATE_REEXEC:-} ]] && ! cmp -s "$0" "$APP_DIR/deploy/update-vps.sh"; then
  NEW_COPY=$(mktemp /tmp/motionmro-update.XXXXXX.sh)
  cp "$APP_DIR/deploy/update-vps.sh" "$NEW_COPY"
  exec env MRO_UPDATE_COPY=1 MRO_UPDATE_REEXEC=1 MRO_UPDATE_BEFORE="$BEFORE" bash "$NEW_COPY" "$@"
fi
if [[ $BEFORE == $AFTER ]]; then
  echo 'O código já estava na versão mais nova.'
else
  echo 'Arquivos alterados nesta atualização:'
  runuser -u $APP_USER -- git -C $APP_DIR diff --name-only "$BEFORE" "$AFTER"
fi

echo '== 2/4 Dependências e banco =='
bash "$APP_DIR/deploy/update-youtube.sh" "$APP_USER" "$STATE/audio-env"
runuser -u $APP_USER -- "${BUILD_ENV[@]}" bash -c "cd $APP_DIR && bun install --frozen-lockfile"
NEW_MIGRATIONS=$(runuser -u $APP_USER -- git -C $APP_DIR diff --name-only "$BEFORE" "$AFTER" -- deploy/local/migrations || true)
if [[ -n $NEW_MIGRATIONS ]]; then
  echo 'Aplicando novas migrações do banco...'
  runuser -u $APP_USER -- "${BUILD_ENV[@]}" MRO_AUTH_EMAIL_CONFIRMATIONS=false node $APP_DIR/deploy/local.mjs install
fi

echo '== 3/4 Build de produção =='
runuser -u $APP_USER -- "${BUILD_ENV[@]}" node $APP_DIR/deploy/local.mjs build

echo '== 4/4 Reiniciar serviços e conferir =='
systemctl restart motionmro-app motionmro-render
for i in {1..60}; do curl -fsS http://127.0.0.1:8080/ >/dev/null 2>&1 && break; sleep 2; done
curl -fsS http://127.0.0.1:8080/ >/dev/null || { echo 'App não iniciou. Consulte: journalctl -u motionmro-app -e'; exit 1; }
for i in {1..60}; do curl -fsS http://127.0.0.1:4401/ >/dev/null 2>&1 && break; sleep 2; done
curl -fsS http://127.0.0.1:4401/ >/dev/null || { echo 'Render não iniciou. Consulte: journalctl -u motionmro-render -e'; exit 1; }
curl -fsS http://127.0.0.1/ >/dev/null || { echo 'Nginx não respondeu. Consulte: journalctl -u nginx -e'; exit 1; }
echo 'Atualização concluída. Se o ícone da aba continuar o antigo, recarregue a página com Ctrl+Shift+R.'
