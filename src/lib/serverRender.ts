import type { OverlayProject } from "./overlays";
import type { Project } from "./projects";
import { renderTrilhaWav } from "./sfx";
import { getCreds, SERVIDOR_PADRAO } from "./settings";

export type Engine = "ffmpeg" | "hyperframes";
export function servidorUrl() { return (getCreds().servidor || SERVIDOR_PADRAO).replace(/\/+$/, ""); }

async function enviar(fd: FormData) {
  let r: Response;
  try { r = await fetch(`${servidorUrl()}/render`, { method: "POST", body: fd }); }
  catch { throw new Error(`Não consegui falar com o servidor de renderização em ${servidorUrl()}. Ele está ligado?`); }
  if (!r.ok) throw new Error(`O servidor falhou: ${(await r.text()).slice(0, 300)}`);
  return r.blob();
}

export async function renderNoServidor(p: OverlayProject, engine: Engine) {
  const overlays = p.overlays.filter((o) => o.html);
  const fd = new FormData();
  fd.append("manifest", JSON.stringify({ engine, largura: p.largura, altura: p.altura, duracao: p.duracao, fps: 30,
    overlays: overlays.map((o) => ({ inicio: o.inicio, fim: o.fim, camera: o.camera, html: o.html })) }));
  fd.append("video", p.video, "video");
  if (p.sons) {
    const ev = overlays.flatMap((o) => (o.sons ?? []).map((s) => ({ t: o.inicio + s.t, tipo: s.tipo })));
    if (ev.length) fd.append("sfx", await renderTrilhaWav(ev, [], p.duracao), "sfx.wav");
  }
  return enviar(fd);
}

/** Motion IA: cada cena vira uma camada em tela cheia, em sequência, com voz e efeitos. */
export async function renderMotionNoServidor(p: Project, engine: Engine) {
  const cenas = p.cenas.filter((c) => c.html);
  let t = 0;
  const camadas = cenas.map((c) => { const o = { inicio: t, fim: t + c.duracao, camera: "nenhum", html: c.html!, cena: c }; t += c.duracao; return o; });
  const fd = new FormData();
  fd.append("manifest", JSON.stringify({ engine, largura: p.config.largura, altura: p.config.altura, duracao: t, fps: 30,
    overlays: camadas.map(({ cena: _c, ...o }) => o) }));
  const ev = p.config.sons ? camadas.flatMap((o) => (o.cena.sons ?? []).map((s) => ({ t: o.inicio + s.t, tipo: s.tipo }))) : [];
  const falas = p.config.voz ? camadas.filter((o) => o.cena.audio).map((o) => ({ t: o.inicio, blob: o.cena.audio! })) : [];
  if (ev.length || falas.length) fd.append("sfx", await renderTrilhaWav(ev, falas, t), "trilha.wav");
  return enviar(fd);
}
