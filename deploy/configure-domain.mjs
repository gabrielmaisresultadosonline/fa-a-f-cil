// Atualiza somente o endereço público da renderização após ativar o domínio.
// Uso interno: node deploy/configure-domain.mjs motionmro.com.br
import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { localCredentials } from './local-env.mjs';

const domain = (process.argv[2] || '').trim().toLowerCase();
if (!/^(?=.{4,253}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(domain)) {
  console.error('Domínio inválido.'); process.exit(1);
}

const workdir = join(homedir(), '.local', 'share', 'motionmro', 'backend');
const supabaseBin = process.env.SUPABASE_CLI || 'supabase';
const status = spawnSync(supabaseBin, ['--workdir', workdir, 'status', '--output', 'json'], { encoding: 'utf8' });
if (status.status !== 0) { console.error('O backend local não está disponível.'); process.exit(1); }
const { url, service } = localCredentials(JSON.parse(status.stdout));
const renderUrl = `https://${domain}/render`;
const response = await fetch(`${url}/rest/v1/app_settings?id=eq.true`, {
  method: 'PATCH',
  headers: { apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ render_url: renderUrl }), signal: AbortSignal.timeout(15000),
});
if (!response.ok) { console.error('Não foi possível salvar o endereço da renderização.'); process.exit(1); }
console.log(`Renderização configurada em ${renderUrl}.`);
