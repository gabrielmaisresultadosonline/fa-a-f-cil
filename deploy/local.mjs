import { spawnSync, spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync, readdirSync, chmodSync, openSync, closeSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { randomBytes } from 'node:crypto';
import { localCredentials, localEnvironment } from './local-env.mjs';
import { configureAuthConfig } from './auth-config.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const state = join(homedir(), '.local', 'share', 'motionmro');
const workdir = join(state, 'backend');
const config = join(workdir, 'supabase');
const keyFile = join(state, 'settings-key');
const productionEntry = join(root, '.output', 'server', 'index.mjs');
const command = process.argv[2] || 'help';
const cli = ['--workdir', workdir];
const supabaseBin = process.env.SUPABASE_CLI || (process.platform === 'win32' ? 'C:\\Users\\MRO\\tools\\supabase.exe' : 'supabase');
function run(binary, args, options = {}) {
  const result = spawnSync(binary, args, { cwd: root, encoding: 'utf8', ...options });
  if (result.error || result.status !== 0) throw new Error(`Não foi possível executar ${binary}. Consulte os requisitos e o registro privado da instalação.`);
  return result.stdout;
}
function backend(args) { return run(supabaseBin, [...cli, ...args]); }
function credentials() {
  if (!existsSync(keyFile)) throw new Error('Execute primeiro: bash deploy/local.sh install');
  const status = JSON.parse(backend(['status', '--output', 'json']));
  localCredentials(status);
  return localEnvironment(status, readFileSync(keyFile, 'utf8').trim(), process.env);
}
async function api(env, path, method = 'GET', body) {
  const response = await fetch(`${env.SUPABASE_URL}${path}`, {
    method, headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, 'Content-Type': 'application/json', Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Configuração local recusada (${response.status}). Nenhuma chave foi exibida.`);
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}
function stream(binary, args, env) {
  const child = spawn(binary, args, { cwd: root, env, stdio: 'inherit' });
  child.on('error', () => { console.error('Não foi possível iniciar o processo local.'); process.exitCode = 1; });
  child.on('exit', (code) => { process.exitCode = code ?? 1; });
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
}
try {
  if (command === 'help') {
    console.log('Uso: bash deploy/local.sh install|app|build|start|render|admin|test|stop');
  } else if (command === 'install') {
    run('docker', ['info']);
    mkdirSync(config, { recursive: true, mode: 0o700 });
    chmodSync(state, 0o700); chmodSync(workdir, 0o700);
    const configFile = join(config, 'config.toml');
    copyFileSync(join(root, 'deploy/local/config.toml'), configFile);
    if (process.env.MRO_PUBLIC_AUTH_URL || process.env.MRO_AUTH_EMAIL_CONFIRMATIONS) {
      writeFileSync(configFile, configureAuthConfig(readFileSync(configFile, 'utf8'), {
        origin: process.env.MRO_PUBLIC_AUTH_URL || 'http://localhost:8080',
        emailConfirmations: process.env.MRO_AUTH_EMAIL_CONFIRMATIONS !== 'false',
      }), { mode: 0o600 });
    }
    mkdirSync(join(config, 'migrations'), { recursive: true });
    for (const name of readdirSync(join(root, 'deploy/local/migrations'))) {
      if (name.endsWith('.sql')) copyFileSync(join(root, 'deploy/local/migrations', name), join(config, 'migrations', name));
    }
    if (!existsSync(keyFile)) writeFileSync(keyFile, randomBytes(32).toString('hex'), { mode: 0o600, flag: 'wx' });
    chmodSync(keyFile, 0o600);
    const fd = openSync(join(state, 'install.log'), 'a', 0o600);
    try {
      console.log('Iniciando PostgreSQL, login e arquivos locais. O primeiro download pode demorar.');
      run(supabaseBin, [...cli, 'start'], { stdio: ['ignore', fd, fd] });
      run(supabaseBin, [...cli, 'migration', 'up', '--local'], { stdio: ['ignore', fd, fd] });
    } finally { closeSync(fd); }
    const env = credentials();
    const buckets = await api(env, '/storage/v1/bucket');
    if (!buckets.some(bucket => bucket.id === 'customer-assets')) {
      await api(env, '/storage/v1/bucket', 'POST', { id: 'customer-assets', name: 'customer-assets', public: false, file_size_limit: 536870912 });
    }
    console.log('Instalação preparada. Banco novo e separado: nenhuma conta ou arquivo do Cloud foi copiado.');
    if (process.env.MRO_DEPLOYMENT_MODE === 'vps') {
      console.log('Backend da VPS preparado; as chaves privilegiadas permanecem internas.');
    } else {
      console.log('Aplicativo: bash deploy/local.sh app');
      console.log('Renderização (outro terminal): bash deploy/local.sh render');
      console.log('E-mails de confirmação e recuperação: http://localhost:54324');
      console.log('Somente desenvolvimento. Não exponha estas portas à internet nem use este ambiente como instalação de produção na VPS.');
    }
  } else if (command === 'app') {
    stream('bun', ['run', 'dev', '--host', process.env.APP_HOST || '127.0.0.1', '--port', process.env.APP_PORT || '8080'], credentials());
  } else if (command === 'build') {
    run('bun', ['run', 'build'], { env: { ...credentials(), NITRO_PRESET: 'node-server', NODE_ENV: 'production' }, stdio: 'inherit' });
    if (!existsSync(productionEntry)) throw new Error('O build de produção não gerou o servidor Node esperado.');
    console.log('Build de produção para VPS concluído.');
  } else if (command === 'start') {
    if (!existsSync(productionEntry)) throw new Error('Execute primeiro: node deploy/local.mjs build');
    const host = process.env.APP_HOST || '127.0.0.1';
    const port = process.env.APP_PORT || '8080';
    stream('node', [productionEntry], { ...credentials(), HOST: host, PORT: port, NITRO_HOST: host, NITRO_PORT: port, NODE_ENV: 'production' });
  } else if (command === 'render') {
    const env = { HOST: '127.0.0.1', PORT: '4400', ...credentials(), DATA_DIR: join(state, 'renders'), RENDER_CONCURRENCY: '1' };
    stream('node', [join(root, 'render-server/server.mjs')], env);
  } else if (command === 'test') {
    stream('node', ['--test', join(root, 'scripts/saas-integration.test.mjs')], credentials());
  } else if (command === 'admin') {
    const email = (process.argv[3] || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Informe o e-mail da conta local já cadastrada e confirmada: bash deploy/local.sh admin seu-email');
    const env = credentials();
    const profiles = await api(env, `/rest/v1/profiles?email=eq.${encodeURIComponent(email)}&select=id`);
    const profile = profiles[0];
    if (!profile || profiles.length !== 1) throw new Error('Cadastre e confirme essa conta local antes de habilitar a administração.');
    const user = await api(env, `/auth/v1/admin/users/${profile.id}`);
    if (!user.email_confirmed_at) throw new Error('Confirme primeiro o e-mail na caixa postal local.');
    await api(env, '/rest/v1/user_roles?on_conflict=user_id,role', 'POST', { user_id: profile.id, role: 'admin' }).catch(async () => {
      const existing = await api(env, `/rest/v1/user_roles?user_id=eq.${profile.id}&role=eq.admin&select=id`);
      if (!existing.length) throw new Error('Não foi possível habilitar o administrador local.');
    });
    console.log(`Administração local habilitada. Entre em ${process.env.APP_ORIGIN || 'http://localhost:8080'}/admin com a senha que você cadastrou.`);
  } else if (command === 'stop') {
    backend(['stop']);
    console.log('Serviços locais parados; dados preservados. Encerre também os terminais do app e renderização.');
  } else throw new Error('Comando desconhecido. Use install, app, build, start, render, admin, test ou stop.');
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Falha na configuração local.');
  process.exitCode = 1;
}
