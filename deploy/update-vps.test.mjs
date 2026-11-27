import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const script = readFileSync(new URL('./update-vps.sh', import.meta.url), 'utf8');

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
