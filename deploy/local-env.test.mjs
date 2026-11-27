import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localCredentials, localEnvironment } from './local-env.mjs';
const status = { API_URL: 'http://127.0.0.1:54321', ANON_KEY: 'local-publishable-fixture', SERVICE_ROLE_KEY: 'local-service-fixture' };
test('local installation refuses a remote backend before any operation', () => {
  assert.throws(() => localCredentials({ ...status, API_URL: 'https://example.com' }), /só pode usar o banco local/);
});
test('local installation refuses alternate ports and embedded credentials', () => {
  for (const API_URL of ['http://localhost:8080', 'http://user:password@localhost:54321', 'http://localhost:54321/remote']) assert.throws(() => localCredentials({ ...status, API_URL }));
});
test('local service key never becomes a browser environment variable', () => {
  const env = localEnvironment(status, 'local-encryption-fixture');
  assert.equal(env.SUPABASE_SERVICE_ROLE_KEY, 'local-service-fixture');
  assert.ok(Object.entries(env).filter(([key]) => key.startsWith('VITE_')).every(([, value]) => value !== status.SERVICE_ROLE_KEY));
});
test('Cloud and legacy environment variables cannot redirect a local session', () => {
  const env = localEnvironment(status, 'local-encryption-fixture', {
    SUPABASE_URL: 'https://example.com', VITE_SUPABASE_URL: 'https://example.com',
    SUPABASE_SECRET_KEYS: 'remote-fixture', VITE_SUPABASE_SECRET: 'remote-fixture',
    AUTH_URL: 'https://example.com', DATABASE_URL: 'remote-fixture', PATH: '/bin',
  });
  assert.equal(env.SUPABASE_URL, 'http://127.0.0.1:54321');
  assert.equal(env.VITE_SUPABASE_URL, env.SUPABASE_URL);
  assert.equal(env.AUTH_URL, env.SUPABASE_URL);
  assert.equal(env.PATH, '/bin');
  assert.equal(env.SUPABASE_SECRET_KEYS, undefined);
  assert.equal(env.VITE_SUPABASE_SECRET, undefined);
  assert.equal(env.DATABASE_URL, undefined);
});
test('rendering uses the same local authentication with localhost origins', () => {
  const env = localEnvironment(status, 'local-encryption-fixture');
  assert.equal(env.AUTH_PUBLISHABLE_KEY, status.ANON_KEY);
  assert.equal(env.APP_ORIGIN, 'http://localhost:8080');
  assert.equal(env.CORS_ORIGINS, 'http://localhost:8080,http://127.0.0.1:8080');
});
test('incomplete local setup fails explicitly, without substituting a Cloud key', () => {
  assert.throws(() => localCredentials({ API_URL: status.API_URL, ANON_KEY: status.ANON_KEY }));
  assert.throws(() => localEnvironment(status, ''));
});
