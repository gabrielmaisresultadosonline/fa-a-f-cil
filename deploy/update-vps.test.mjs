import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const script = readFileSync(new URL('./update-vps.sh', import.meta.url), 'utf8');

test('updates existing YouTube environments without reinstalling UVR', () => {
  assert.match(script, /deploy\/update-youtube\.sh/);
  const youtube = readFileSync(new URL('./update-youtube.sh', import.meta.url), 'utf8');
  assert.match(youtube, /--no-cache-dir --upgrade 'yt-dlp\[default\]'/);
  assert.doesNotMatch(youtube, /pip install.*audio-separator/);
});

test('new updater reexecutes after pulling while preserving migration comparison', () => {
  assert.match(script, /cmp -s "\$0" "\$APP_DIR\/deploy\/update-vps\.sh"/);
  assert.match(script, /MRO_UPDATE_BEFORE="\$BEFORE"/);
  assert.match(script, /BEFORE=\$\{MRO_UPDATE_BEFORE:-/);
});

test('updater requires root and runs from its own copy', () => {
  assert.match(script, /EUID} -ne 0/);
  assert.match(script, /cp "\$0" "\$SELF_COPY"/);
  assert.match(script, /exec env MRO_UPDATE_COPY=1 bash "\$SELF_COPY"/);
});

test('updater leaves /root before running app-user commands', () => {
  assert.match(script, /^cd \$APP_HOME$/m);
  assert.doesNotMatch(script, /runuser .*(\/root|~\/)/);
});

test('updater takes the newest code and shows what changed', () => {
  assert.match(script, /git -C \$APP_DIR fetch origin main/);
  assert.match(script, /git -C \$APP_DIR merge --ff-only origin\/main/);
  assert.match(script, /git -C \$APP_DIR diff --name-only "\$BEFORE" "\$AFTER"/);
});

test('updater rebuilds the production app and restarts both services', () => {
  assert.match(script, /bun install --frozen-lockfile/);
  assert.match(script, /local\.mjs build/);
  assert.match(script, /systemctl restart motionmro-app motionmro-render/);
  assert.match(script, /curl -fsS http:\/\/127\.0\.0\.1:8080\//);
  assert.match(script, /curl -fsS http:\/\/127\.0\.0\.1:4401\//);
});

test('updater applies migrations only when new migration files arrived', () => {
  assert.match(script, /diff --name-only "\$BEFORE" "\$AFTER" -- deploy\/local\/migrations/);
  assert.match(script, /if \[\[ -n \$NEW_MIGRATIONS \]\]/);
  assert.match(script, /MRO_AUTH_EMAIL_CONFIRMATIONS=false node \$APP_DIR\/deploy\/local\.mjs install/);
});

test('updater never prints privileged keys and keeps them in server processes only', () => {
  assert.doesNotMatch(script, /SERVICE_ROLE_KEY/);
  assert.doesNotMatch(script, /echo .*\$SUPABASE_/);
  assert.match(script, /runuser -u \$APP_USER -- "\$\{BUILD_ENV\[@\]\}" node \$APP_DIR\/deploy\/local\.mjs build/);
});

test('YouTube updater installs the PO token provider on loopback only', () => {
  const youtube = readFileSync(new URL('./update-youtube.sh', import.meta.url), 'utf8');
  assert.match(youtube, /bgutil-ytdlp-pot-provider/);
  assert.match(youtube, /-p 127\.0\.0\.1:4416:4416/);
  assert.doesNotMatch(youtube, /-p 4416:4416/);
});
