// Host-only tooling. Never import into the application or a browser bundle.
export function localCredentials(status) {
  const url = status.API_URL;
  const publishable = status.ANON_KEY || status.PUBLISHABLE_KEY;
  const service = status.SERVICE_ROLE_KEY || status.SECRET_KEY;
  if (!url || !publishable || !service) throw new Error('A instalação local não forneceu todas as credenciais. Execute a instalação novamente.');
  const parsed = new URL(url);
  if (parsed.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(parsed.hostname) || parsed.port !== '54321' || parsed.username || parsed.password || parsed.pathname !== '/') {
    throw new Error('Recusado: este iniciador só pode usar o banco local na porta 54321.');
  }
  return { url: parsed.origin, publishable, service };
}
export function localEnvironment(status, privateKey, base = {}) {
  if (!privateKey) throw new Error('A chave de proteção local não está configurada.');
  const { url, publishable, service } = localCredentials(status);
  const clean = Object.fromEntries(Object.entries(base).filter(([key]) => !key.startsWith('SUPABASE_') && !key.startsWith('VITE_SUPABASE_') && !['DATABASE_URL', 'MRO_PRIVATE_SETTINGS_KEY', 'AUTH_URL', 'AUTH_PUBLISHABLE_KEY', 'APP_ORIGIN', 'CORS_ORIGINS'].includes(key)));
  return {
    ...clean,
    VITE_SUPABASE_URL: url,
    VITE_SUPABASE_PUBLISHABLE_KEY: publishable,
    VITE_SUPABASE_ANON_KEY: publishable,
    VITE_SUPABASE_PROJECT_ID: 'motionmro-local',
    SUPABASE_URL: url,
    SUPABASE_PUBLISHABLE_KEY: publishable,
    SUPABASE_ANON_KEY: publishable,
    SUPABASE_SERVICE_ROLE_KEY: service,
    MRO_PRIVATE_SETTINGS_KEY: privateKey,
    AUTH_URL: url,
    AUTH_PUBLISHABLE_KEY: publishable,
    APP_ORIGIN: base.APP_ORIGIN || 'http://localhost:8080',
    CORS_ORIGINS: [base.APP_ORIGIN, 'http://localhost:8080', 'http://127.0.0.1:8080'].filter(Boolean).join(','),
  };
}
