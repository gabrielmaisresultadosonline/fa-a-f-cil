import type { OverlayProject } from "./overlays";
import { renderSfxWav } from "./sfx";
import { getCreds, SERVIDOR_PADRAO } from "./settings";

export type Engine = "ffmpeg" | "hyperframes";
export function servidorUrl() { return (getCreds().servidor || SERVIDOR_PADRAO).replace(/\/+$/, ""); }

export async function pingServidor() {
  try { const r = await fetch(servidorUrl(), { method: "GET" }); return r.ok; } catch { return false; }
}

export async function renderNoServidor(p: OverlayProject, engine: Engine) {
  const overlays = p.overlays.filter((o) => o.html);
  const fd = new FormData();
  fd.append("manifest", JSON.stringify({ engine, largura: p.largura, altura: p.altura, duracao: p.duracao, fps: 30,
    overlays: overlays.map((o) => ({ inicio: o.inicio, fim: o.fim, camera: o.camera, html: o.html })) }));
  fd.append("video", p.video, "video");
  if (p.sons) {
    const ev = overlays.flatMap((o) => (o.sons ?? []).map((s) => ({ t: o.inicio + s.t, tipo: s.tipo })));
    if (ev.length) fd.append("sfx", await renderSfxWav(ev, p.duracao), "sfx.wav");
  }
  let r: Response;
  try { r = await fetch(`${servidorUrl()}/render`, { method: "POST", body: fd }); }
  catch { throw new Error(`Não consegui falar com o servidor de renderização em ${servidorUrl()}. Ele está ligado?`); }
  if (!r.ok) throw new Error(`O servidor falhou: ${(await r.text()).slice(0, 300)}`);
  return r.blob();
}
