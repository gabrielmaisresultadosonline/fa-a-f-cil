// Cria/confirma a conta admin local. Uso: node deploy/create-admin.mjs email [senha]
// A senha pode vir de MRO_ADMIN_PASSWORD ou stdin, evitando exposição na lista de processos.
import { join } from 'node:path';
import { homedir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { localCredentials } from './local-env.mjs';

const [emailArg, passwordArg] = process.argv.slice(2);
const email = emailArg?.trim().toLowerCase();
async function passwordFromStdin() {
  if (process.stdin.isTTY) return '';
  let input = '';
  for await (const chunk of process.stdin) input += chunk;
  return input.split('\n')[0].replace(/\r$/, '');
}
const password = process.env.MRO_ADMIN_PASSWORD || passwordArg || await passwordFromStdin();
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password) {
  console.error('Uso: node deploy/create-admin.mjs email senha'); process.exit(1);
}
if (password.length < 8) { console.error('A senha deve ter pelo menos 8 caracteres.'); process.exit(1); }

const workdir = join(homedir(), '.local', 'share', 'motionmro', 'backend');
const supabaseBin = process.env.SUPABASE_CLI || (process.platform === 'win32' ? 'C:\\Users\\MRO\\tools\\supabase.exe' : 'supabase');
const statusRaw = spawnSync(supabaseBin, ['--workdir', workdir, 'status', '--output', 'json'], { encoding: 'utf8' });
if (statusRaw.status !== 0) { console.error('Falha ao ler status local.'); process.exit(1); }
const { url, service } = localCredentials(JSON.parse(statusRaw.stdout));

async function api(path, method = 'GET', body) {
  const r = await fetch(`${url}${path}`, {
    method,
    headers: { apikey: service, 'Content-Type': 'application/json', Authorization: `Bearer ${service}` },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const t = await r.text();
  return { ok: r.ok, status: r.status, json: t ? JSON.parse(t) : null };
}

let user;
const list = await api(`/auth/v1/admin/users?filter=${encodeURIComponent(email)}`);
const existing = (list.json?.users ?? []).find((u) => u.email === email);
if (existing) {
  const upd = await api(`/auth/v1/admin/users/${existing.id}`, 'PUT', { password, email_confirm: true });
  if (!upd.ok) { console.error('Falha ao atualizar conta:', upd.status); process.exit(1); }
  user = upd.json;
  console.log('Conta existente atualizada (senha nova, e-mail confirmado).');
} else {
  const created = await api('/auth/v1/admin/users', 'POST', { email, password, email_confirm: true });
  if (!created.ok) { console.error('Falha ao criar conta:', created.status, JSON.stringify(created.json)); process.exit(1); }
  user = created.json;
  console.log('Conta criada e confirmada.');
}
if (!user?.id) { console.error('O serviço de autenticação não retornou a conta criada.'); process.exit(1); }

if (process.env.MRO_RENDER_URL) {
  const renderUrl = new URL(process.env.MRO_RENDER_URL);
  if (!['http:', 'https:'].includes(renderUrl.protocol) || renderUrl.pathname !== '/' || renderUrl.username || renderUrl.password) {
    console.error('Endereço de renderização inválido.'); process.exit(1);
  }
  const settings = await api('/rest/v1/app_settings?id=eq.true', 'PATCH', { render_url: renderUrl.origin });
  if (!settings.ok) { console.error('Conta criada, mas falha ao configurar a renderização:', settings.status); process.exit(1); }
  console.log('Servidor de renderização configurado automaticamente.');
}
