#!/usr/bin/env bash
# Recria/redefine a conta de administrador na VPS. Uso: sudo bash /home/motionmro/app/deploy/reset-admin.sh
set -euo pipefail
[[ $EUID -eq 0 ]] || { echo 'Rode com sudo.'; exit 1; }
APP_USER=motionmro
APP_HOME=/home/$APP_USER
APP_DIR=$APP_HOME/app
SUPABASE_BIN=$APP_HOME/.local/bin/supabase
cd /tmp
[[ -d $APP_DIR ]] || { echo "MotionMRO não encontrado em $APP_DIR."; exit 1; }
read -r -p 'E-mail do administrador: ' ADMIN_EMAIL
ADMIN_EMAIL=${ADMIN_EMAIL,,}
ADMIN_EMAIL=${ADMIN_EMAIL//[[:space:]]/}
[[ $ADMIN_EMAIL =~ ^[^@]+@[^@]+\.[^@]+$ ]] || { echo 'E-mail inválido.'; exit 1; }
read -r -s -p 'Nova senha (mínimo 8 caracteres): ' P1; echo
read -r -s -p 'Repita a senha: ' P2; echo
[[ $P1 == "$P2" ]] || { echo 'As senhas não coincidem.'; exit 1; }
[[ ${#P1} -ge 8 ]] || { echo 'A senha deve ter pelo menos 8 caracteres.'; exit 1; }
printf -v EM '%q' "$ADMIN_EMAIL"
printf '%s\n' "$P1" | runuser -u $APP_USER -- env HOME=$APP_HOME SUPABASE_CLI=$SUPABASE_BIN bash -c "cd $APP_DIR && node deploy/create-admin.mjs $EM && node deploy/local.mjs admin $EM"
unset P1 P2
echo "Pronto. Entre em /admin com $ADMIN_EMAIL e a nova senha."
