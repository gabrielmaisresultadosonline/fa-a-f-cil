import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const domain = readFileSync(new URL('./configure-domain.sh', import.meta.url), 'utf8');
const cookies = readFileSync(new URL('./import-youtube-cookies.sh', import.meta.url), 'utf8');
const settings = readFileSync(new URL('../render-server/youtube-settings.mjs', import.meta.url), 'utf8');
const admin = readFileSync(new URL('../src/components/motion/YoutubeCookieSettings.tsx', import.meta.url), 'utf8');

test('domain setup targets motionmro.com.br and requires both DNS records before changing services', () => {
  assert.match(domain, /DOMAIN=\$\{1:-motionmro\.com\.br\}/);
  assert.match(domain, /A  @    \$PUBLIC_IP/);
  assert.match(domain, /A  www  \$PUBLIC_IP/);
  assert.ok(domain.indexOf('if ! check_dns') < domain.indexOf("apt-get install -y certbot"));
});

test('domain setup enables HTTPS for app and same-origin rendering', () => {
  assert.match(domain, /APP_ORIGIN=https:\/\/\$DOMAIN/);
  assert.match(domain, /RENDER_ORIGIN=\$APP_ORIGIN\/render/);
  assert.match(domain, /certbot --nginx -d "\$DOMAIN" -d "www\.\$DOMAIN"/);
  assert.match(domain, /location \/render\/ \{/);
  assert.match(domain, /proxy_pass http:\/\/127\.0\.0\.1:4401\//);
  assert.match(domain, /ufw allow 443\/tcp/);
});

test('terminal cookie import never prints the session and removes its temporary copy', () => {
  assert.match(cookies, /install -o \$APP_USER -g \$APP_USER -m 600 "\$SOURCE" "\$TEMP"/);
  assert.match(cookies, /trap cleanup EXIT/);
  assert.match(cookies, /runuser -u \$APP_USER -- env MRO_DATA_DIR=/);
  assert.doesNotMatch(cookies, /cat \$|echo .*\$\(cat|base64/);
});

test('terminal cookie import shows the file age and deletes the uploaded file after success', () => {
  assert.match(cookies, /Arquivo recebido em:/);
  assert.match(cookies, /AGE_MIN > 30/);
  assert.ok(cookies.indexOf('shred -u "$SOURCE"') > cookies.indexOf('import-youtube-cookies.mjs" "$TEMP"'));
});

test('plain public HTTP cookie upload remains blocked', () => {
  assert.match(settings, /A new browser credential must not cross the public IP over plain HTTP/);
  assert.match(settings, /if \(!local\) return false/);
  assert.match(settings, /x-forwarded-proto'\] === 'https'/);
});

test('admin shows the terminal alternative when accessed by plain IP', () => {
  assert.match(admin, /Pelo IP sem HTTPS, importe o arquivo diretamente na VPS/);
  assert.match(admin, /import-youtube-cookies\.sh \/root\/cookies\.txt/);
  assert.match(admin, /Consultar status/);
});
