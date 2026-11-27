import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { configureAuthConfig, normalizePublicOrigin } from './auth-config.mjs';

const source = readFileSync(new URL('./local/config.toml', import.meta.url), 'utf8');

test('VPS auth uses the public IP for signup and password redirect links', () => {
  const output = configureAuthConfig(source, { origin: 'http://203.0.113.10', emailConfirmations: false });
  assert.match(output, /^site_url = "http:\/\/203\.0\.113\.10"$/m);
  assert.match(output, /"http:\/\/203\.0\.113\.10\/auth"/);
  assert.match(output, /"http:\/\/203\.0\.113\.10\/reset-password"/);
  assert.match(output, /^enable_confirmations = false$/m);
  assert.equal(output.match(/^enable_signup = true$/gm)?.length, 2);
});

test('local development keeps email confirmation and localhost redirects', () => {
  const output = configureAuthConfig(source, { origin: 'http://localhost:8080' });
  assert.match(output, /^enable_confirmations = true$/m);
  assert.match(output, /^site_url = "http:\/\/localhost:8080"$/m);
});

test('public origins reject credentials, paths and non-HTTP protocols', () => {
  for (const value of ['file:///tmp/app', 'http://user:password@example.com', 'https://example.com/private', 'https://example.com?x=1']) {
    assert.throws(() => normalizePublicOrigin(value));
  }
  assert.equal(normalizePublicOrigin('https://motionmro.com.br/'), 'https://motionmro.com.br');
});
