import { randomUUID } from "node:crypto";
// MotionMRO — servidor de renderização e áudio (localhost ou VPS)
// Requisitos: Node 22+, FFmpeg. yt-dlp e audio-separator habilitam música e remoção de voz.
import http from "node:http";
import { writeFile, mkdir, readFile, rm, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { Readable } from "node:stream";
import puppeteer from "puppeteer";
import { RenderQueue, validJobId, validateManifest } from "./jobs.mjs";
import { copyMediaIntoJob, downloadYoutube, importLocalAudio, mediaDirectory, mediaInfo, mixEditorAudio, rangeCovered, separateVocals, separationRange, streamMediaAudio } from "./audio.mjs";
import { authenticate,assertAdministrator,assertOwner,assertMediaOwner,ownedCloudRow,retentionExpired,authorizedGeneration } from "./security.mjs";
import { PaymentChecks } from "./payments.mjs";
import { YoutubeSettings, secureCookieUpload } from './youtube-settings.mjs';

const PORT = Number(process.env.PORT || 4400);
const HOST = process.env.HOST || "127.0.0.1";
const DATA_DIR = resolve(process.env.DATA_DIR || "./data");
const MEDIA_DIR = join(DATA_DIR, "media");
const MAX_UPLOAD = Number(process.env.MAX_UPLOAD_MB || 512) * 1024 * 1024;
const youtubeSettings = new YoutubeSettings(DATA_DIR);

function run(cmd, args, cwd, onOutput) {
  return new Promise((res, rej) => {
    const p = spawn(cmd, args, { cwd, shell: process.platform === "win32" });
    let err = "";
    p.stderr.on("data", (d) => { err += d; if (err.length > 20000) err = err.slice(-20000); });
    p.stdout.on("data", (d) => { if (onOutput) onOutput(String(d)); else process.stdout.write(d); });
    p.on("error", rej);
    p.on("close", (c) => (c === 0 ? res() : rej(new Error(`${cmd} saiu com código ${c}\n${err.slice(-2000)}`))));
  });
}
async function temAudio(file) {
  return new Promise((res) => {
    const p = spawn("ffprobe", ["-v", "error", "-select_streams", "a", "-show_entries", "stream=index", "-of", "csv=p=0", file], { shell: process.platform === "win32" });
    let o = ""; p.stdout.on("data", (d) => (o += d)); p.on("error", () => res(false)); p.on("close", () => res(o.trim().length > 0));
  });
}

// Renderiza cada overlay HTML como sequência de PNG transparentes, quadro a quadro (determinístico)
async function renderOverlayFrames(browser, ov, i, m, dir, onFrame) {
  const out = join(dir, `ov${i}`); await mkdir(out, { recursive: true });
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: m.largura, height: m.altura });
    await page.setRequestInterception(true);
    page.on("request",(request)=>{try{const url=new URL(request.url());if(["data:","about:","blob:"].includes(url.protocol)||["cdn.jsdelivr.net","fonts.googleapis.com","fonts.gstatic.com"].includes(url.hostname))void request.continue();else void request.abort();}catch{void request.abort();}});
    await page.setContent(ov.html, { waitUntil: "networkidle0", timeout: 60000 });
    await page.evaluate(() => document.fonts?.ready);
    await page.evaluate(() => window.__motionLayoutReady);
    const t0 = await page.evaluate(() => (window.gsap ? window.gsap.globalTimeline.time() : 0));
    const dur = ov.fim - ov.inicio; const n = Math.max(1, Math.round(dur * m.fps));
    for (let f = 0; f < n; f++) {
      const t = f / m.fps;
      await page.evaluate((t, t0) => {
        if (window.__tl) { window.__tl.pause(); window.__tl.time(t, false); }
        else if (window.gsap) { window.gsap.globalTimeline.pause(); window.gsap.globalTimeline.time(t0 + t, false); }
        for (const a of document.getAnimations()) { a.pause(); a.currentTime = t * 1000; }
      }, t, t0);
      await page.screenshot({ path: join(out, `${String(f).padStart(5, "0")}.png`), omitBackground: true });
      onFrame();
    }
    return out;
  } finally { await page.close(); }
}

function zoomExpr(ovs) {
  const parts = [];
  for (const o of ovs) {
    const a = o.inicio, b = o.fim, p = `(it-${a})/${Math.max(0.01, b - a)}`, w = `between(it,${a},${b})`;
    if (o.camera === "punch") parts.push(`${w}*0.14`);
    else if (o.camera === "zoom-in") parts.push(`${w}*0.10*${p}`);
    else if (o.camera === "zoom-out") parts.push(`${w}*0.10*(1-${p})`);
    else if (o.camera === "pan-esquerda" || o.camera === "pan-direita") parts.push(`${w}*0.12`);
  }
  return parts.length ? `1+${parts.join("+")}` : "1";
}
function panExpr(ovs) {
  const parts = [];
  for (const o of ovs) {
    const p = `(it-${o.inicio})/${Math.max(0.01, o.fim - o.inicio)}`, w = `between(it,${o.inicio},${o.fim})`;
    if (o.camera === "pan-esquerda") parts.push(`${w}*(-0.5+${p})`);
    if (o.camera === "pan-direita") parts.push(`${w}*(0.5-${p})`);
  }
  return parts.length ? parts.join("+") : "0";
}

async function renderFFmpeg(m, dir, video, sfx, frames, progress, editorAudio) {
  const W = m.largura, H = m.altura, out = join(dir, "final.mp4");
  const args = ["-y", "-i", video];
  frames.forEach((f) => args.push("-framerate", String(m.fps), "-i", join(f, "%05d.png")));
  if (sfx) args.push("-i", sfx);
  const z = zoomExpr(m.overlays), px = panExpr(m.overlays);
  let fc = `[0:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},fps=${m.fps},zoompan=z='${z}':x='iw/2-(iw/zoom/2)+(${px})*(iw-iw/zoom)':y='ih/2-(ih/zoom/2)':d=1:s=${W}x${H}:fps=${m.fps}[b0]`;
  frames.forEach((_, i) => {
    const o = m.overlays[i];
    fc += `;[${i + 1}:v]format=rgba,setpts=PTS-STARTPTS+${o.inicio}/TB[o${i}];[b${i}][o${i}]overlay=0:0:enable='between(t,${o.inicio},${o.fim})':eof_action=pass[b${i + 1}]`;
  });
  const vOut = `[b${frames.length}]`;
  const hasA = await temAudio(video), sIdx = frames.length + 1;
  let aMap = [];
  if (editorAudio) {
    // O mix do editor já inclui (ou explicitamente silencia) o áudio original.
    if (sfx) aMap = ["-map", `${sIdx}:a`];
  } else if (sfx && hasA) { fc += `;[0:a][${sIdx}:a]amix=inputs=2:duration=first:normalize=0[a]`; aMap = ["-map", "[a]"]; }
  else if (sfx) aMap = ["-map", `${sIdx}:a`];
  else if (hasA) aMap = ["-map", "0:a"];
  args.push("-filter_complex_threads", "1", "-filter_complex", fc, "-map", vOut, ...aMap, "-c:v", "libx264", "-threads", "2", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-t", String(m.duracao), "-movflags", "+faststart", "-progress", "pipe:1", "-nostats", out);
  let pending = "";
  await run("ffmpeg", args, dir, (chunk) => {
    pending += chunk;
    const lines = pending.split("\n"); pending = lines.pop() || "";
    for (const line of lines) {
      const match = /^out_time_us=(\d+)/.exec(line);
      if (match) progress(75 + 24 * Math.min(1, Number(match[1]) / 1e6 / m.duracao), "Codificando MP4 · FFmpeg");
    }
  });
  return out;
}

const CAM = { "punch": [1.14, 0, 0.25], "zoom-in": [1.1, 0], "zoom-out": [1, 0], "pan-esquerda": [1.12, 4], "pan-direita": [1.12, -4] };
async function renderHyperFrames(m, dir, video, sfx, frames, progress, editorAudio) {
  const proj = join(dir, "hf"); await mkdir(join(proj, "assets"), { recursive: true });
  await run("ffmpeg", ["-y", "-i", video, "-c", "copy", join(proj, "assets", "video.mp4")], dir).catch(() => run("ffmpeg", ["-y", "-i", video, join(proj, "assets", "video.mp4")], dir));
  for (let i = 0; i < frames.length; i++) {
    await run("ffmpeg", ["-y", "-framerate", String(m.fps), "-i", join(frames[i], "%05d.png"), "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-b:v", "4M", join(proj, "assets", `ov${i}.webm`)], dir);
    progress(75 + 10 * (i + 1) / frames.length, `Preparando camada ${i + 1}/${frames.length} · HyperFrames`);
  }
  if (sfx) await writeFile(join(proj, "assets", "sfx.wav"), await readFile(sfx));
  const hasA = await temAudio(video), keepVideoAudio = hasA && !editorAudio;
  const tweens = m.overlays.map((o) => {
    const c = CAM[o.camera]; if (!c) return "";
    const d = c[2] ?? Math.max(0.2, o.fim - o.inicio);
    return `tl.to("#cam",{scale:${c[0]},xPercent:${c[1]},duration:${d},ease:"power2.out"},${o.inicio});tl.to("#cam",{scale:1,xPercent:0,duration:0.6,ease:"power2.inOut"},${o.fim});`;
  }).join("\n");
  const html = `<!doctype html><html><head><meta charset="utf-8"><script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js"></script>
<style>html,body{margin:0;background:#000}#cam{position:absolute;inset:0;transform-origin:50% 50%}#cam video{width:100%;height:100%;object-fit:cover}</style></head><body>
<div id="root" data-composition-id="root" data-start="0" data-duration="${m.duracao}" data-width="${m.largura}" data-height="${m.altura}" style="position:relative;width:${m.largura}px;height:${m.altura}px;overflow:hidden">
  <div id="cam"><video class="clip" src="assets/video.mp4" playsinline ${keepVideoAudio ? 'data-has-audio="true"' : "muted"} data-start="0" data-duration="${m.duracao}" data-track-index="0"></video></div>
  ${m.overlays.map((o, i) => `<video class="clip" src="assets/ov${i}.webm" muted playsinline style="position:absolute;inset:0;width:100%;height:100%" data-start="${o.inicio}" data-duration="${(o.fim - o.inicio).toFixed(3)}" data-track-index="${i + 1}"></video>`).join("\n  ")}
  ${sfx ? `<audio class="clip" src="assets/sfx.wav" data-start="0" data-duration="${m.duracao}" data-track-index="${frames.length + 1}"></audio>` : ""}
</div>
<script>const tl=gsap.timeline({paused:true});tl.set("#cam",{scale:1},0);
${tweens}
tl.set({}, {}, ${m.duracao});window.__timelines=window.__timelines||{};window.__timelines.root=tl;</script></body></html>`;
  await writeFile(join(proj, "index.html"), html);
  await writeFile(join(proj, "hyperframes.json"), JSON.stringify({ name: "motionmro", fps: m.fps }, null, 2));
  const out = join(dir, "final.mp4");
  progress(85, "Codificando MP4 · HyperFrames");
  let pending = "", last = 0;
  await run("npx", ["--yes", "hyperframes@0.9.100", "render", "--output", out, "--fps", String(m.fps), "--workers", "1"], proj, (chunk) => {
    process.stdout.write(chunk);
    pending += chunk;
    const lines = pending.split("\n"); pending = lines.pop() || "";
    for (const line of lines) {
      if (!line.startsWith("@hf-progress ")) continue;
      try {
        const event = JSON.parse(line.slice(13));
        if (Number.isFinite(event.pct) && (Date.now() - last > 500 || event.pct === 100)) {
          last = Date.now(); progress(85 + 14 * Math.min(100, Math.max(0, event.pct)) / 100, "Codificando MP4 · HyperFrames");
        }
      } catch { /* Ignore non-progress CLI output. */ }
    }
  });
  return out;
}

function cors(req,res) {
  const origins=(process.env.CORS_ORIGINS||process.env.APP_ORIGIN||"http://localhost:8080").split(",");
  if(origins.includes(req.headers.origin))res.setHeader("Access-Control-Allow-Origin",req.headers.origin);
  res.setHeader("Vary","Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Allow-Private-Network", "true");
}

const queue = new RenderQueue(DATA_DIR, async (m, dir, progress) => {
  const video = join(dir, "input.mp4");
  const exists = (path) => stat(path).then(() => true, () => false);
  let browser;
  try {
    if (!(await exists(video))) await run("ffmpeg", ["-y", "-f", "lavfi", "-i", `color=c=black:s=${m.largura}x${m.altura}:d=${m.duracao}:r=${m.fps}`, "-c:v", "libx264", "-pix_fmt", "yuv420p", video], dir);
    let sfx = await exists(join(dir, "sfx.wav")) ? join(dir, "sfx.wav") : null;
    browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
    const frames = [];
    const totalFrames = m.overlays.reduce((n, o) => n + Math.max(1, Math.round((o.fim - o.inicio) * m.fps)), 0);
    let done = 0, last = 0;
    for (let i = 0; i < m.overlays.length; i++) {
      progress(5 + 70 * done / totalFrames, `Renderizando camada ${i + 1}/${m.overlays.length}`);
      frames.push(await renderOverlayFrames(browser, m.overlays[i], i, m, dir, () => {
        done++;
        if (Date.now() - last > 500 || done === totalFrames) { last = Date.now(); progress(5 + 70 * done / totalFrames, `Quadros ${done}/${totalFrames}`); }
      }));
    }
    progress(75, "Preparando MP4");
    if (m.audio) { progress(75, "Mixando camadas de áudio"); sfx = await mixEditorAudio(m, dir, video); }
    if (m.engine === "hyperframes") await renderHyperFrames(m, dir, video, sfx, frames, progress, !!m.audio);
    else await renderFFmpeg(m, dir, video, sfx, frames, progress, !!m.audio);
    for (const path of frames) await rm(path, { recursive: true, force: true });
    await rm(join(dir, "hf"), { recursive: true, force: true });
  } finally { await browser?.close(); }
}, process.env.RENDER_CONCURRENCY);
await queue.init();
await mkdir(MEDIA_DIR, { recursive: true });
const checks=new PaymentChecks(join(DATA_DIR,"payment-checks"),process.env.APP_ORIGIN||"http://localhost:8080");
await checks.init();
const expireVideos=async()=>{for(const job of queue.jobs.values())if(retentionExpired(job))await queue.expire(job.id);};
await expireVideos();setInterval(()=>void expireVideos().catch(()=>{}),60000).unref();

const json = (res, status, value) => { res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" }); res.end(JSON.stringify(value)); };
async function bodyJson(req) {
  let body = "";
  for await (const chunk of req) { body += chunk; if (body.length > 100_000) throw new Error("Pedido muito grande"); }
  return JSON.parse(body || "{}");
}

const separations = new Map(), tasks = new Map();
const server = http.createServer(async (req, res) => {
  cors(req,res);
  if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }
  const path = new URL(req.url || "/", "http://localhost").pathname;
  if (req.method === "GET" && path === "/") return json(res, 200, { ok: true, app: "motionmro-render", version: 4, backgroundQueue: true, mediaTools: true,secureAccounts:true,retentionDays:2 });
  try {
    const user=await authenticate(req);
    if (path === '/admin/youtube') {
      await assertAdministrator(user);
      if (req.method === 'GET') return json(res, 200, await youtubeSettings.status());
      if (req.method === 'DELETE') return json(res, 200, await youtubeSettings.remove());
      if (req.method === 'PATCH') { const body = await bodyJson(req); return json(res, 200, await youtubeSettings.setEnabled(body.enabled)); }
      if (req.method === 'POST') {
        if (!secureCookieUpload(req)) throw new Error('Envio de cookies exige HTTPS ou localhost. Use o auxiliar local enquanto estiver pelo IP.');
        const chunks = []; let received = 0;
        for await (const chunk of req) { received += chunk.length; if (received > 1024 * 1024 + 100_000) throw new Error('Arquivo de sessão acima de 1 MB.'); chunks.push(chunk); }
        const form = await new Request('http://localhost', { method: 'POST', headers: { 'Content-Type': req.headers['content-type'] || '' }, body: Buffer.concat(chunks) }).formData();
        const file = form.get('cookies');
        if (!file || typeof file === 'string') throw new Error('Selecione um arquivo cookies.txt.');
        return json(res, 200, await youtubeSettings.save(Buffer.from(await file.arrayBuffer())));
      }
      return json(res, 405, { erro: 'Operação indisponível.' });
    }
    if(req.method==="POST"&&path==="/payment-checks"){
      const body=await bodyJson(req);await ownedCloudRow(user,"payment_orders",body.id);await checks.add(body.id,body.key,user.id);return json(res,202,{accepted:true});
    }
    if (req.method === "POST" && path === "/media/youtube") {
      const body = await bodyJson(req);
      const options = await youtubeSettings.downloadOptions();
      // Downloads run in the background so the editor can poll and show progress.
      const taskId = randomUUID(); const task = { user: user.id, progresso: 0, fase: "iniciando" };
      tasks.set(taskId, task);
      downloadYoutube(MEDIA_DIR, String(body.url || ""), options, (p, fase) => { task.progresso = Math.round(p); task.fase = fase; })
        .then(async (media) => { await writeFile(join(MEDIA_DIR, media.id, "owner.json"), JSON.stringify({ user_id: user.id })); task.resultado = media; task.progresso = 100; })
        .catch((e) => { task.erro = String(e?.message || e); })
        .finally(() => setTimeout(() => tasks.delete(taskId), 600000).unref());
      return json(res, 202, { tarefa: taskId, progresso: 0, fase: "iniciando" });
    }
    const taskMatch = /^\/media\/tarefa\/([0-9a-f-]{36})$/.exec(path);
    if (req.method === "GET" && taskMatch) {
      const task = tasks.get(taskMatch[1]);
      if (!task || task.user !== user.id) return json(res, 404, { erro: "Tarefa não encontrada. Tente baixar novamente." });
      if (task.erro) return json(res, 400, { erro: task.erro });
      return json(res, 200, { progresso: task.progresso, fase: task.fase, resultado: task.resultado });
    }
    if (req.method === 'POST' && path === '/media/upload') {
      const max = 300 * 1024 * 1024 + 100_000;
      let received = 0;
      const limited = Readable.from((async function* () {
        for await (const chunk of req) {
          received += chunk.length;
          if (received > max) throw new Error('Áudio acima do limite de 300 MB.');
          yield chunk;
        }
      })());
      const form = await new Request('http://localhost', { method: 'POST', headers: req.headers, body: limited, duplex: 'half' }).formData();
      const audio = form.get('audio');
      if (!audio || typeof audio === 'string') throw new Error('Arquivo de áudio ausente.');
      const media = await importLocalAudio(MEDIA_DIR, Buffer.from(await audio.arrayBuffer()), audio.name);
      try { await writeFile(join(MEDIA_DIR, media.id, 'owner.json'), JSON.stringify({ user_id: user.id })); }
      catch (error) { await rm(join(MEDIA_DIR, media.id), { recursive: true, force: true }); throw error; }
      return json(res, 201, media);
    }
    const media = /^\/media\/([^/]+)(?:\/(audio|separate))?$/.exec(path);
    if (media) {
      const [, id, action] = media;
      mediaDirectory(MEDIA_DIR, id);
      await assertMediaOwner(MEDIA_DIR,id,user);
      if (req.method === "GET" && !action) return json(res, 200, await mediaInfo(MEDIA_DIR, id));
      if (req.method === "POST" && action === "separate") {
        // UVR on CPU can exceed HTTP timeouts, so run it in the background and let the editor poll.
        const info = await mediaInfo(MEDIA_DIR, id);
        const range = separationRange(info, await bodyJson(req).catch(() => ({})));
        if (info.instrumentalDisponivel && rangeCovered(info.faixaSemVoz, range)) return json(res, 200, info);
        const state = separations.get(id);
        if (state?.erro) { separations.delete(id); return json(res, 400, { erro: state.erro }); }
        if (!state) {
          separations.set(id, { running: true, progresso: 0 });
          const entry = separations.get(id);
          separateVocals(MEDIA_DIR, id, (p) => { entry.progresso = p; }, range).then(() => separations.delete(id), (e) => {
            console.warn("UVR falhou:", e?.message || e);
            separations.set(id, { erro: "Não foi possível remover a voz desta música no servidor. Verifique se o UVR foi instalado (rode o atualizador) e tente novamente." });
          });
        }
        return json(res, 202, { ...info, separando: true, progresso: separations.get(id)?.progresso || 0 });
      }
      if (req.method === "GET" && action === "audio") {
        const stem = new URL(req.url || "/", "http://localhost").searchParams.get("stem") === "instrumental" ? "instrumental" : "original";
        const { file, stream } = streamMediaAudio(MEDIA_DIR, id, stem);
        const info = await stat(file);
        res.writeHead(200, { "Content-Type": "audio/wav", "Content-Length": info.size, "Cache-Control": "private, max-age=3600" });
        stream.on("error", () => res.destroy()); res.on("close", () => stream.destroy());
        return stream.pipe(res);
      }
      return json(res, 405, { erro: "Operação de mídia indisponível" });
    }
    const match = /^\/jobs\/([^/]+)(?:\/(download|retry))?$/.exec(path);
    if (!match || !validJobId(match[1])) return json(res, 404, { erro: "Atualize o servidor de renderização para a versão 3." });
    const [, id, action] = match;
    if (req.method === "POST" && !action) {
      if (queue.get(id)) { assertOwner(queue.get(id).userId,user);req.resume(); return json(res, 200, queue.get(id)); }
      if (Number(req.headers["content-length"]) > MAX_UPLOAD) return json(res, 413, { erro: "Arquivo excede o limite de envio do servidor" });
      let received = 0;
      const limited = Readable.from((async function* () {
        for await (const chunk of req) {
          received += chunk.length;
          if (received > MAX_UPLOAD) throw new Error("Arquivo excede o limite de envio do servidor");
          yield chunk;
        }
      })());
      const form = await new Request("http://localhost", { method: "POST", headers: req.headers, body: limited, duplex: "half" }).formData();
      const m = validateManifest(JSON.parse(String(form.get("manifest"))));
      const project=await ownedCloudRow(user,"customer_projects",m.projectId);
      await authorizedGeneration(user,m.projectId);
      if(!["motion","overlay"].includes(project.kind)||project.data?.status!=="pronto")throw new Error("Conclua a prévia antes de renderizar.");
      const duration=project.kind==="motion"?project.data.config?.duracao:project.data.duracao;
      if(!Number.isFinite(duration)||m.duracao>duration+0.01||duration>600)throw new Error("Duração não autorizada.");
      m.userId=user.id;
      const job = await queue.submit(id, m, async (dir) => {
        for (const [field, name] of [["video", "input.mp4"], ["sfx", "sfx.wav"]]) {
          const file = form.get(field);
          if (file && typeof file !== "string") await writeFile(join(dir, name), Buffer.from(await file.arrayBuffer()));
        }
        for (let i = 0; i < (m.audio?.clips.length ?? 0); i++) {
          const clip = m.audio.clips[i], file = form.get(`audio_${i}`), destination = join(dir, `audio_${i}`);
          if (file && typeof file !== "string") await writeFile(destination, Buffer.from(await file.arrayBuffer()));
          else if (clip.mediaId) {await assertMediaOwner(MEDIA_DIR,clip.mediaId,user);await copyMediaIntoJob(MEDIA_DIR, clip.mediaId, clip.stem || "original", destination);}
          else throw new Error(`O clipe ${i + 1} não tem um arquivo de áudio`);
        }
      });
      return json(res, 202, job);
    }
    const job = queue.get(id);
    if (!job) return json(res, 404, { erro: "Renderização não encontrada neste servidor" });
    assertOwner(job.userId,user);
    if(retentionExpired(job)){await queue.expire(id);return json(res,410,{erro:"MP4 expirado após dois dias"});}
    if (req.method === "GET" && !action) return json(res, 200, job);
    if (req.method === "POST" && action === "retry") return json(res, 202, await queue.retry(id));
    if (req.method === "DELETE" && !action) { await queue.remove(id); return json(res, 200, { ok: true }); }
    if (req.method === "GET" && action === "download") {
      if (job.status !== "concluido") return json(res, 409, { erro: "O MP4 ainda não está pronto" });
      const file = join(queue.directory(id), "final.mp4");
      const info = await stat(file);
      const name = job.nome.replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 100) || "video";
      res.writeHead(200, { "Content-Type": "video/mp4", "Content-Length": info.size, "Content-Disposition": `attachment; filename="${name}.mp4"` });
      const stream = createReadStream(file);
      stream.on("error", () => res.destroy()); res.on("close", () => stream.destroy());
      return stream.pipe(res);
    }
    return json(res, 405, { erro: "Operação indisponível" });
  } catch (e) {
    console.warn("Operação recusada:",e?.message||"erro");
    if (!res.headersSent) json(res, 400, { erro: String(e?.message || e) });
    else res.destroy();
  }
});
server.requestTimeout = 0;
server.listen(PORT, HOST, () => console.log(`MotionMRO render v3 em http://${HOST}:${PORT} · dados: ${DATA_DIR} · workers: ${queue.concurrency}`));
