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

test('VPS checks disk space and avoids duplicate Python package caches', () => {
  assert.match(script, /MIN_FREE_KB=\$\(\(8 \* 1024 \* 1024\)\)/);
  assert.match(script, /pip install --no-cache-dir/);
  assert.match(script, /apt-get clean/);
  assert.match(script, /APP_HOME\/\.cache\/pip/);
  assert.match(script, /TMPDIR=\$STATE\/tmp/);
});

test('every Ubuntu Python installer avoids package caches', () => {
  for (const file of ['vps-install.sh', 'install-vps-ubuntu.sh', 'install-ubuntu.sh']) {
    const content = readFileSync(new URL(`./${file}`, import.meta.url), 'utf8');
    const pipLines = content.split('\n').filter((line) => line.includes('pip install') || line.includes('pip" install'));
    assert.ok(pipLines.length > 0, `${file} deve instalar os recursos de áudio`);
    for (const line of pipLines) assert.match(line, /--no-cache-dir/, file);
  }
});

test('VPS browser and render receive the detected public IP', () => {
  assert.match(script, /MRO_PUBLIC_AUTH_URL=\$APP_ORIGIN/);
  assert.match(script, /MRO_RENDER_URL=\$RENDER_ORIGIN/);
  assert.match(script, /APP_ORIGIN=http:\/\/\$PUBLIC_HOST/);
});

test('VPS installs voice removal on Python 3.12 and keeps going if it fails', () => {
  assert.match(script, /venv --seed --python 3\.12/);
  assert.match(script, /build-essential python3-dev/);
  assert.match(script, /if ! runuser .*audio-separator/);
});

test('VPS restarts with the repository installer when the download was an older copy', () => {
  assert.match(script, /cmp -s "\$0" "\$APP_DIR\/deploy\/vps-install\.sh"/);
  assert.match(script, /exec env MRO_INSTALLER_COPY=1 MRO_INSTALLER_REEXEC=1 bash "\$NEW_COPY"/);
  assert.match(script, /cp "\$0" "\$SELF_COPY"/);
});
