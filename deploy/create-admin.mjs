// Cria/confirma a conta admin local. Uso: node deploy/create-admin.mjs email [senha]
// A senha também pode vir de MRO_ADMIN_PASSWORD (evita exposição na lista de processos).
import { join } from 'node:path';
import { homedir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { localCredentials } from './local-env.mjs';

const [email, passwordArg] = process.argv.slice(2);
const password = process.env.MRO_ADMIN_PASSWORD || passwordArg;
if (!email || !password) { console.error('Uso: node deploy/create-admin.mjs email senha'); process.exit(1); }

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
console.log('user id:', user.id);
