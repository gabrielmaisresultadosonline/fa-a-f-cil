import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';

export function normalizeYoutubeCookies(bytes) {
  if (!bytes.length || bytes.length > 1024 * 1024) throw new Error('Envie um cookies.txt de até 1 MB.');
  const lines = bytes.toString('utf8').replace(/^\uFEFF/, '').split(/\r?\n/);
  if (!['# Netscape HTTP Cookie File', '# HTTP Cookie File'].includes(lines[0])) throw new Error('Exporte o arquivo no formato cookies.txt Netscape.');
  const rows = lines.filter((line) => {
    if (!line || (line.startsWith('#') && !line.startsWith('#HttpOnly_'))) return false;
    const fields = line.split('\t');
    if (fields.length !== 7) throw new Error('Formato cookies.txt inválido.');
    const domain = fields[0].replace(/^#HttpOnly_/, '').replace(/^\./, '').toLowerCase();
    return domain === 'youtube.com' || domain.endsWith('.youtube.com');
  });
  if (!rows.length) throw new Error('O arquivo não contém uma sessão do YouTube. Exporte somente cookies do YouTube.');
  return Buffer.from(['# Netscape HTTP Cookie File', ...rows, ''].join('\n'));
}
export class YoutubeSettings {
  constructor(root) { this.dir = join(root, '.youtube-private'); this.stateFile = join(this.dir, 'settings.json'); this.keyFile = join(this.dir, 'key'); this.queue = Promise.resolve(); }
  async read() {
    try { return JSON.parse(await readFile(this.stateFile, 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return null; throw new Error('Não foi possível ler a configuração privada do YouTube.'); }
  }
  async key() {
    await mkdir(this.dir, { recursive: true, mode: 0o700 });
    try { return await readFile(this.keyFile); }
    catch (error) {
      if (error.code !== 'ENOENT') throw new Error('Chave privada do YouTube indisponível.');
      try { await writeFile(this.keyFile, randomBytes(32), { mode: 0o600, flag: 'wx' }); }
      catch (failure) { if (failure.code !== 'EEXIST') throw new Error('Não foi possível preparar a chave privada do YouTube.'); }
      return readFile(this.keyFile);
    }
  }
  async write(state) {
    await mkdir(this.dir, { recursive: true, mode: 0o700 });
    const temp = join(this.dir, `settings-${randomBytes(12).toString('hex')}.tmp`);
    await writeFile(temp, JSON.stringify(state), { mode: 0o600 });
    await rename(temp, this.stateFile);
  }
  mutate(action) {
    const task = this.queue.catch(() => {}).then(action); this.queue = task; return task;
  }
  async status() {
    const state = await this.read();
    return { configured: !!state?.encrypted, enabled: !!state?.encrypted && state.enabled === true, updatedAt: state?.updatedAt || null };
  }
  save(bytes) {
    const normalized = normalizeYoutubeCookies(bytes);
    return this.mutate(async () => {
      const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', await this.key(), iv);
      const encrypted = Buffer.concat([cipher.update(normalized), cipher.final()]);
      await this.write({ enabled: false, updatedAt: Date.now(), encrypted: encrypted.toString('base64'), iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64') });
      return this.status();
    });
  }
  setEnabled(enabled) {
    if (typeof enabled !== 'boolean') throw new Error('Ativação inválida.');
    return this.mutate(async () => {
      const state = await this.read();
      if (enabled && !state?.encrypted) throw new Error('Envie os cookies antes de ativar.');
      await this.write({ ...state, enabled, updatedAt: Date.now() });
      return this.status();
    });
  }
  remove() { return this.mutate(async () => { await this.write({ enabled: false, updatedAt: Date.now() }); return this.status(); }); }
  async downloadOptions() {
    const state = await this.read();
    if (!state) return { allowEnvironment: true };
    if (!state.enabled || !state.encrypted) return { allowEnvironment: false };
    try {
      const decipher = createDecipheriv('aes-256-gcm', await this.key(), Buffer.from(state.iv, 'base64'));
      decipher.setAuthTag(Buffer.from(state.tag, 'base64'));
      const cookies = Buffer.concat([decipher.update(Buffer.from(state.encrypted, 'base64')), decipher.final()]);
      return { cookies, allowEnvironment: false };
    } catch { throw new Error('Configuração privada do YouTube inválida. Reenvie o arquivo pelo administrador.'); }
  }
}

/** A new browser credential must not cross the public IP over plain HTTP. */
export function secureCookieUpload(req) {
  const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
  if (!local) return false;
  if (req.headers['x-forwarded-proto'] === 'https') return true;
  try { return ['localhost', '127.0.0.1', '[::1]'].includes(new URL(req.headers.origin).hostname); }
  catch { return false; }
}