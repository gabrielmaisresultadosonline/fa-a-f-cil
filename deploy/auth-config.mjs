// Host-only deployment helpers. Never import into browser code.
export function normalizePublicOrigin(value) {
  const parsed = new URL(value);
  if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname || parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) {
    throw new Error('O endereço público deve conter apenas protocolo, host e porta opcional.');
  }
  return parsed.origin;
}

function replaceSetting(source, key, value) {
  const pattern = new RegExp(`^${key} = .*$`, 'm');
  if (!pattern.test(source)) throw new Error(`Configuração local incompleta: ${key}.`);
  return source.replace(pattern, `${key} = ${value}`);
}

export function configureAuthConfig(source, { origin, emailConfirmations = true }) {
  const publicOrigin = normalizePublicOrigin(origin);
  const redirects = [
    `${publicOrigin}/auth`,
    `${publicOrigin}/reset-password`,
    'http://localhost:8080/auth',
    'http://localhost:8080/reset-password',
    'http://127.0.0.1:8080/auth',
    'http://127.0.0.1:8080/reset-password',
  ];
  let output = replaceSetting(source, 'site_url', JSON.stringify(publicOrigin));
  output = replaceSetting(output, 'additional_redirect_urls', `[${[...new Set(redirects)].map(JSON.stringify).join(', ')}]`);
  return replaceSetting(output, 'enable_confirmations', emailConfirmations ? 'true' : 'false');
}
