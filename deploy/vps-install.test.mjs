import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const script = readFileSync(new URL('./vps-install.sh', import.meta.url), 'utf8');

test('VPS accepts Ubuntu 24.04 and 26.04 LTS', () => {
  assert.match(script, /\^\(24\|26\)\\\.04\$/);
  assert.match(script, /Ubuntu 24\.04 ou 26\.04 LTS/);
});

test('VPS runs a Node production build instead of exposing the development server', () => {
  assert.match(script, /local\.mjs build/);
  assert.match(script, /local\.mjs start/);
  assert.doesNotMatch(script, /ExecStart=.*local\.mjs app/);
});

test('VPS exposes app and authenticated render but blocks Docker backend ports', () => {
  assert.match(script, /ufw allow 80\/tcp/);
  assert.match(script, /ufw allow 4400\/tcp/);
  assert.match(script, /DOCKER-USER 1 -p tcp -m multiport --dports 54320:54329 -j REJECT/);
  assert.doesNotMatch(script, /ufw allow 5432[0-9]/);
});

test('VPS browser and render receive the detected public IP', () => {
  assert.match(script, /MRO_PUBLIC_AUTH_URL=\$APP_ORIGIN/);
  assert.match(script, /MRO_RENDER_URL=\$RENDER_ORIGIN/);
  assert.match(script, /APP_ORIGIN=http:\/\/\$PUBLIC_HOST/);
});
