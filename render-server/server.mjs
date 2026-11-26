// MotionMRO — servidor de renderização (localhost ou VPS)
// Requisitos: Node 22+, FFmpeg no PATH. HyperFrames é usado via `npx hyperframes` quando escolhido.
import http from "node:http";
import { mkdtemp, writeFile, mkdir, readFile, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import puppeteer from "puppeteer";

const PORT = Number(process.env.PORT || 4400);
const FPS_PADRAO = 30;

function run(cmd, args, cwd) {
  return new Promise((res, rej) => {
    const p = spawn(cmd, args, { cwd, shell: process.platform === "win32" });
    let err = "";
    p.stderr.on("data", (d) => { err += d; if (err.length > 20000) err = err.slice(-20000); });
    p.stdout.on("data", (d) => process.stdout.write(d));
    p.on("close", (c) => (c === 0 ? res() : rej(new Error(`${cmd} saiu com código ${c}\n${err.slice(-2000)}`))));
  });
}
async function temAudio(file) {
  return new Promise((res) => {
    const p = spawn("ffprobe", ["-v", "error", "-select_streams", "a", "-show_entries", "stream=index", "-of", "csv=p=0", file], { shell: process.platform === "win32" });
    let o = ""; p.stdout.on("data", (d) => (o += d)); p.on("close", () => res(o.trim().length > 0));
  });
}

// Renderiza cada overlay HTML como sequência de PNG transparentes, quadro a quadro (determinístico)
async function renderOverlayFrames(browser, ov, i, m, dir) {
  const out = join(dir, `ov${i}`); await mkdir(out, { recursive: true });
  const page = await browser.newPage();
  await page.setViewport({ width: m.largura, height: m.altura });
  await page.setContent(ov.html, { waitUntil: "networkidle0", timeout: 60000 });
  await page.evaluate(() => document.fonts?.ready);
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
  }
  await page.close();
  return out;
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

async function renderFFmpeg(m, dir, video, sfx, frames) {
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
  if (sfx && hasA) { fc += `;[0:a][${sIdx}:a]amix=inputs=2:duration=first:normalize=0[a]`; aMap = ["-map", "[a]"]; }
  else if (sfx) aMap = ["-map", `${sIdx}:a`];
  else if (hasA) aMap = ["-map", "0:a"];
  args.push("-filter_complex", fc, "-map", vOut, ...aMap, "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-t", String(m.duracao), "-movflags", "+faststart", out);
  await run("ffmpeg", args, dir);
  return out;
}

const CAM = { "punch": [1.14, 0, 0.25], "zoom-in": [1.1, 0], "zoom-out": [1, 0], "pan-esquerda": [1.12, 4], "pan-direita": [1.12, -4] };
async function renderHyperFrames(m, dir, video, sfx, frames) {
  const proj = join(dir, "hf"); await mkdir(join(proj, "assets"), { recursive: true });
  await run("ffmpeg", ["-y", "-i", video, "-c", "copy", join(proj, "assets", "video.mp4")], dir).catch(() => run("ffmpeg", ["-y", "-i", video, join(proj, "assets", "video.mp4")], dir));
  // overlays viram vídeos WebM com transparência
  for (let i = 0; i < frames.length; i++)
    await run("ffmpeg", ["-y", "-framerate", String(m.fps), "-i", join(frames[i], "%05d.png"), "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-b:v", "4M", join(proj, "assets", `ov${i}.webm`)], dir);
  if (sfx) await writeFile(join(proj, "assets", "sfx.wav"), await readFile(sfx));
  const hasA = await temAudio(video);
  const tweens = m.overlays.map((o) => {
    const c = CAM[o.camera]; if (!c) return "";
    const d = c[2] ?? Math.max(0.2, o.fim - o.inicio);
    return `tl.to("#cam",{scale:${c[0]},xPercent:${c[1]},duration:${d},ease:"power2.out"},${o.inicio});tl.to("#cam",{scale:1,xPercent:0,duration:0.6,ease:"power2.inOut"},${o.fim});`;
  }).join("\n");
  const html = `<!doctype html><html><head><meta charset="utf-8"><script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js"></script>
<style>html,body{margin:0;background:#000}#cam{position:absolute;inset:0;transform-origin:50% 50%}#cam video{width:100%;height:100%;object-fit:cover}</style></head><body>
<div id="root" data-composition-id="root" data-start="0" data-duration="${m.duracao}" data-width="${m.largura}" data-height="${m.altura}" style="position:relative;width:${m.largura}px;height:${m.altura}px;overflow:hidden">
  <div id="cam"><video class="clip" src="assets/video.mp4" playsinline ${hasA ? 'data-has-audio="true"' : "muted"} data-start="0" data-duration="${m.duracao}" data-track-index="0"></video></div>
  ${m.overlays.map((o, i) => `<video class="clip" src="assets/ov${i}.webm" muted playsinline style="position:absolute;inset:0;width:100%;height:100%" data-start="${o.inicio}" data-duration="${(o.fim - o.inicio).toFixed(3)}" data-track-index="${i + 1}"></video>`).join("\n  ")}
  ${sfx ? `<audio class="clip" src="assets/sfx.wav" data-start="0" data-duration="${m.duracao}" data-track-index="${frames.length + 1}"></audio>` : ""}
</div>
<script>const tl=gsap.timeline({paused:true});tl.set("#cam",{scale:1},0);
${tweens}
tl.set({}, {}, ${m.duracao});window.__timelines=window.__timelines||{};window.__timelines.root=tl;</script></body></html>`;
  await writeFile(join(proj, "index.html"), html);
  await writeFile(join(proj, "hyperframes.json"), JSON.stringify({ name: "motionmro", fps: m.fps }, null, 2));
  const out = join(dir, "final.mp4");
  await run("npx", ["--yes", "hyperframes", "render", "--output", out], proj);
  return out;
}

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Allow-Private-Network", "true");
}

let browser;
http.createServer(async (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }
  if (req.method === "GET") { res.writeHead(200, { "Content-Type": "application/json" }); return res.end(JSON.stringify({ ok: true, app: "motionmro-render" })); }
  if (req.method !== "POST" || !req.url?.startsWith("/render")) { res.writeHead(404); return res.end(); }
  const dir = await mkdtemp(join(tmpdir(), "mmro-"));
  try {
    const form = await new Request("http://x", { method: "POST", headers: req.headers, body: req, duplex: "half" }).formData();
    const m = JSON.parse(String(form.get("manifest")));
    m.fps = m.fps || FPS_PADRAO;
    const video = join(dir, "input"); await writeFile(video, Buffer.from(await form.get("video").arrayBuffer()));
    let sfx = null; const s = form.get("sfx");
    if (s && typeof s !== "string") { sfx = join(dir, "sfx.wav"); await writeFile(sfx, Buffer.from(await s.arrayBuffer())); }
    browser ??= await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
    console.log(`▶ ${m.engine} · ${m.largura}x${m.altura} · ${m.duracao}s · ${m.overlays.length} overlays`);
    const frames = [];
    for (let i = 0; i < m.overlays.length; i++) { console.log(`  overlay ${i + 1}/${m.overlays.length}`); frames.push(await renderOverlayFrames(browser, m.overlays[i], i, m, dir)); }
    const out = m.engine === "hyperframes" ? await renderHyperFrames(m, dir, video, sfx, frames) : await renderFFmpeg(m, dir, video, sfx, frames);
    const buf = await readFile(out);
    res.writeHead(200, { "Content-Type": "video/mp4", "Content-Length": buf.length }); res.end(buf);
    console.log("✔ pronto");
  } catch (e) {
    console.error(e);
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" }); res.end(String(e?.message || e));
  } finally { rm(dir, { recursive: true, force: true }).catch(() => {}); }
}).listen(PORT, () => console.log(`MotionMRO render server em http://localhost:${PORT}`));
