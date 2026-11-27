// MotionMRO local companion. Never import this Node module into the web app.
import http from 'node:http';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtemp, writeFile, readFile, readdir, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const AUDIO_LIMIT = 300 * 1024 * 1024;
export function validYoutube(value) {
  try {
    const u = new URL(value);
    return ['http:', 'https:'].includes(u.protocol) && !u.username && !u.password &&
      ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be'].includes(u.hostname);
  } catch { return false; }
}
export function localArguments(url, output, browser, cookies) {
  if (!validYoutube(url)) throw new Error('Link do YouTube inválido.');
  if (!['chrome', 'edge', 'firefox'].includes(browser)) throw new Error('Navegador inválido.');
  const args = ['--ignore-config', '--no-playlist', '--js-runtimes', `node:${process.execPath}`,
    '--socket-timeout', '30', '--retries', '2', '--max-filesize', '300M', '--quiet',
    '--no-simulate', '--print', 'after_move:%(title)s', '-f', 'bestaudio/best', '-o', output];
  // No cookie export: browser session remains in the local yt-dlp process.
  args.push(...(cookies ? ['--cookies', cookies] : ['--cookies-from-browser', browser]));
  return [...args, '--', url];
}
function run(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const p = spawn(command, args, { cwd, windowsHide: true });
    let out = '';
    const timer = setTimeout(() => p.kill(), 8 * 60_000);
    p.stdout.on('data', (d) => { out = (out + String(d)).slice(-2000); });
    // Do not print, store or return extractor diagnostics or browser session data.
    p.stderr.on('data', () => {});
    p.on('error', () => { clearTimeout(timer); reject(new Error('Ferramenta local indisponível. Execute novamente o instalador do auxiliar.')); });
    p.on('close', (code) => {
      clearTimeout(timer);
      code === 0 ? resolve(out) : reject(new Error('O download local não foi autorizado. Confirme o acesso ao vídeo no navegador escolhido; se Chrome ou Edge bloquearem a sessão, use Firefox ou um arquivo de sessão novo, somente neste computador.'));
    });
  });
}
export async function downloadLocal(url, browser, cookieBytes) {
  const dir = await mkdtemp(join(tmpdir(), 'motionmro-local-'));
  try {
    let cookieFile;
    if (cookieBytes?.length) {
      const header = cookieBytes.toString('utf8').split(/\r?\n/, 1)[0];
      if (!['# Netscape HTTP Cookie File', '# HTTP Cookie File'].includes(header)) throw new Error('O arquivo precisa estar no formato cookies.txt Netscape.');
      cookieFile = join(dir, 'session.txt');
      await writeFile(cookieFile, cookieBytes, { mode: 0o600 });
    }
    const title = await run(process.env['YTDLP_COMMAND'] || 'yt-dlp', localArguments(url, join(dir, 'audio.%(ext)s'), browser, cookieFile), dir);
    const name = (await readdir(dir)).find((x) => /^audio\.(webm|m4a|mp4|mp3|ogg|opus|wav|flac|aac)$/i.test(x));
    if (!name) throw new Error('O download não gerou áudio.');
    const wav = join(dir, 'original.wav');
    await run(process.env['FFMPEG_COMMAND'] || 'ffmpeg', ['-y', '-i', join(dir, name), '-vn', '-ac', '2', '-ar', '48000', '-c:a', 'pcm_s16le', '-fs', String(AUDIO_LIMIT), wav], dir);
    if ((await stat(wav)).size >= AUDIO_LIMIT) throw new Error('O áudio excede 300 MB. Escolha uma faixa menor.');
    return { name: title.trim().split(/\r?\n/).at(-1)?.slice(0, 180) || 'Música do YouTube', bytes: await readFile(wav) };
  } finally { await rm(dir, { recursive: true, force: true }); }
}
const escape = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function createHelper({ download = downloadLocal } = {}) {
  const pending = new Map();
  let busy = false;
  const server = http.createServer(async (req, res) => {
    const host = req.headers.host || '';
    if (!/^(127\.0\.0\.1|localhost):\d+$/.test(host)) { res.writeHead(403); res.end(); return; }
    const localOrigin = `http://${host}`;
    const url = new URL(req.url || '/', localOrigin);
    const send = (status, message) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify({ error: message })); };
    try {
      if (req.method === 'GET' && url.pathname === '/connect') {
        const origin = url.searchParams.get('origin') || '', requestId = url.searchParams.get('requestId') || '', video = url.searchParams.get('url') || '';
        const parsed = new URL(origin);
        if (parsed.origin !== origin || !['http:', 'https:'].includes(parsed.protocol) || !/^[\da-f-]{36}$/i.test(requestId) || !validYoutube(video)) return send(400, 'Pedido inválido. Abra pelo editor do MotionMRO.');
        const nonce = randomBytes(32).toString('hex');
        for (const [key, value] of pending) if (value.expires < Date.now()) pending.delete(key);
        if (pending.size >= 20) return send(429, 'Feche as janelas antigas e tente novamente.');
        pending.set(nonce, { origin, requestId, video, expires: Date.now() + 10 * 60_000 });
        const scriptNonce = randomBytes(18).toString('base64');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store',
          'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY',
          'Content-Security-Policy': `default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${scriptNonce}'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'` });
        res.end(`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Música local — MotionMRO</title>
<style>:root{--bg:#101114;--fg:#f4f4f5;--muted:#a1a1aa;--accent:#facc15;--edge:#3f3f46}*{box-sizing:border-box}body{background:var(--bg);color:var(--fg);font:16px system-ui;margin:0;padding:24px}main{max-width:520px;margin:24px auto}h1{font-size:26px}p{color:var(--muted);overflow-wrap:anywhere}label{display:block;margin:22px 0 8px}select,input,button{width:100%;padding:12px;border:1px solid var(--edge);border-radius:6px;background:var(--bg);color:var(--fg);font:inherit}button{margin-top:24px;background:var(--accent);color:var(--bg);font-weight:700;cursor:pointer}button:disabled{opacity:.6}#status{min-height:48px}</style>
<main><h1>MotionMRO · Música local</h1><p>Destino: ${escape(origin)}</p><p>Somente o áudio será enviado. A sessão fica neste computador.</p>
<form id="form"><label for="browser">Navegador com acesso ao YouTube</label><select id="browser" name="browser"><option value="chrome">Chrome</option><option value="firefox">Firefox</option><option value="edge">Edge</option></select>
<label for="cookies">Arquivo de sessão novo (opcional, uso somente local)</label><input id="cookies" name="cookies" type="file" accept=".txt"><p>Use apenas conteúdo próprio ou autorizado. O YouTube pode restringir a conta mesmo com uma sessão válida.</p>
<button id="submit">Autorizar, baixar e enviar áudio</button><p id="status" role="status"></p></form></main>
<script nonce="${scriptNonce}">const nonce=${JSON.stringify(nonce)};const form=document.getElementById('form');form.onsubmit=async(e)=>{e.preventDefault();const status=document.getElementById('status'),button=document.getElementById('submit');button.disabled=true;status.textContent='Baixando no seu computador…';try{if(!window.opener)throw Error('Abra o auxiliar pelo botão do editor.');const response=await fetch('/download',{method:'POST',headers:{'X-MotionMRO-Nonce':nonce},body:new FormData(form)});if(!response.ok){const data=await response.json();throw Error(data.error||'Download recusado.')}const buffer=await response.arrayBuffer();window.opener.postMessage({type:'motionmro-local-audio',requestId:${JSON.stringify(requestId)},name:decodeURIComponent(response.headers.get('X-Audio-Name')||'Música do YouTube'),buffer},${JSON.stringify(origin)},[buffer]);status.textContent='Áudio enviado ao editor. Você pode fechar esta janela.';}catch(error){status.textContent=error.message;button.disabled=false;}};</script></html>`);
        return;
      }
      if (req.method === 'POST' && url.pathname === '/download') {
        if (req.headers.origin !== localOrigin) return send(403, 'Origem não autorizada.');
        const nonce = req.headers['x-motionmro-nonce'];
        const grant = pending.get(nonce);
        if (!grant || grant.expires < Date.now()) return send(403, 'Abra novamente o auxiliar pelo editor.');
        if (busy) return send(409, 'Aguarde o download em andamento.');
        const chunks = []; let size = 0;
        for await (const chunk of req) { size += chunk.length; if (size > 1024 * 1024) return send(413, 'Arquivo de sessão muito grande.'); chunks.push(chunk); }
        const form = await new Request(`${localOrigin}/download`, { method: 'POST', headers: { 'Content-Type': req.headers['content-type'] || '' }, body: Buffer.concat(chunks) }).formData();
        const browser = String(form.get('browser') || 'chrome');
        if (!['chrome', 'edge', 'firefox'].includes(browser)) return send(400, 'Navegador inválido.');
        const file = form.get('cookies');
        const cookieBytes = file && typeof file !== 'string' && file.size ? Buffer.from(await file.arrayBuffer()) : undefined;
        busy = true;
        try {
          const audio = await download(grant.video, browser, cookieBytes);
          if (!audio.bytes.length || audio.bytes.length > AUDIO_LIMIT) return send(413, 'Áudio fora do limite permitido.');
          pending.delete(nonce);
          res.writeHead(200, { 'Content-Type': 'audio/wav', 'Content-Length': audio.bytes.length, 'Cache-Control': 'no-store', 'X-Audio-Name': encodeURIComponent(audio.name.replace(/[\r\n]/g, '').slice(0, 180)) });
          res.end(audio.bytes);
        } finally { busy = false; }
        return;
      }
      send(404, 'Abra o auxiliar pelo editor do MotionMRO.');
    } catch { send(400, 'Não foi possível baixar. Confirme o acesso ao vídeo; use Firefox ou um arquivo de sessão novo no próprio computador se o navegador bloquear a leitura.'); }
  });
  return server;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (Number(process.versions.node.split('.')[0]) < 22) throw new Error('Instale Node.js 22 ou mais recente.');
  const server = createHelper();
  server.on('error', () => { console.error('Não foi possível iniciar o auxiliar. Feche outra instância e tente novamente.'); process.exitCode = 1; });
  server.listen(47831, '127.0.0.1', () => console.log('Auxiliar MotionMRO ativo neste computador. Volte ao editor e escolha Meu navegador. Mantenha esta janela aberta.'));
}