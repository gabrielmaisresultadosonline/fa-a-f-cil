// Diagnóstico: roda o yt-dlp com os cookies ativos do admin e mostra só informações seguras.
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { YoutubeSettings } from '../render-server/youtube-settings.mjs';
import { youtubeArguments } from '../render-server/youtube.mjs';

const LOGIN_COOKIES = ['LOGIN_INFO', 'SID', '__Secure-3PSID', 'SAPISID', '__Secure-3PAPISID'];

/** Names only: values never leave this function. */
export function describeCookies(text) {
  const names = new Set(text.split(/\r?\n/).map((line) => line.split('\t')).filter((f) => f.length === 7).map((f) => f[5]));
  return { total: names.size, missingLogin: LOGIN_COOKIES.filter((name) => !names.has(name)) };
}

/** Keeps only diagnostic lines and strips anything that looks like a cookie or token value. */
export function safeLines(output) {
  return output.split(/\r?\n/)
    .filter((line) => /ERROR|WARNING|PO ?Token|bgutil|pot|JS runtime|Plugin|version/i.test(line))
    .map((line) => line.replace(/(cookie|token|visitor|sapisid|psid)[^\s]*[=:]\s*\S+/gi, '$1=<oculto>').slice(0, 400));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const url = process.argv[2];
  const options = await new YoutubeSettings(process.env.DATA_DIR || './data').downloadOptions();
  const dir = await mkdtemp(join(process.env.TMPDIR || tmpdir(), 'yt-test-'));
  try {
    let cookieFile;
    if (options.cookies) {
      cookieFile = join(dir, 'cookies.txt');
      await writeFile(cookieFile, options.cookies, { mode: 0o600 });
      const info = describeCookies(options.cookies.toString('utf8'));
      console.log(`Cookies ativos: ${info.total} cookies do YouTube.`);
      console.log(info.missingLogin.length ? `ATENÇÃO: faltam cookies de login (${info.missingLogin.join(', ')}). Exporte novamente com a conta conectada.` : 'Cookies de login presentes.');
    } else console.log('ATENÇÃO: nenhum cookie ativo no admin.');
    const args = youtubeArguments(join(dir, 'x.%(ext)s'), url, cookieFile).filter((a) => a !== '--quiet' && a !== '--no-simulate');
    args.splice(args.indexOf('--'), 0, '--simulate', '-v');
    const child = spawn('yt-dlp', args, { cwd: dir });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { out += d; });
    const code = await new Promise((resolve) => child.on('close', resolve));
    for (const line of safeLines(out)) console.log(line);
    console.log(code === 0 ? 'RESULTADO: o download funcionaria com esta configuração.' : 'RESULTADO: o YouTube recusou o download (veja as linhas acima).');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
