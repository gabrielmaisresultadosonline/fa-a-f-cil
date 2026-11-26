import type { OverlayProject } from "./overlays";
import type { Project } from "./projects";
import { renderTrilhaWav } from "./sfx";
import { getCreds, SERVIDOR_PADRAO } from "./settings";
import { prepareSceneHtml } from "./sceneLayout";

export type Engine = "ffmpeg" | "hyperframes";
export function servidorUrl() { return (getCreds().servidor || SERVIDOR_PADRAO).replace(/\/+$/, ""); }

export interface ServerJob {
  id: string; status: "na fila" | "renderizando" | "concluido" | "erro";
  progresso: number; etapa: string; inicio?: number; fim?: number; erro?: string;
}
export async function serverRequest(url: string, init?: RequestInit): Promise<ServerJob> {
  let response: Response;
  try { response = await fetch(url, { ...init, signal: AbortSignal.timeout(15000) }); }
  catch { throw new Error("Servidor indisponível. A renderização já enviada continua nele; o acompanhamento voltará quando reconectar."); }
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message.slice(0, 300) || "Não foi possível acessar a renderização");
  }
  return response.json();
}
/** XHR reports actual uploaded bytes; a 202 means the server owns the durable job. */
export function enviarJob(fd: FormData, id: string, server: string, onUpload: (percent: number) => void): Promise<ServerJob> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${server}/jobs/${id}`);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onUpload(Math.round(e.loaded / e.total * 100)); };
    xhr.onerror = () => reject(new Error(`Não consegui falar com o servidor em ${server}. Confira o endereço e se ele está ligado.`));
    xhr.onabort = () => reject(new Error("Envio cancelado antes da confirmação do servidor"));
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(`O servidor recusou o envio: ${xhr.responseText.slice(0, 300)}. Se usa a versão antiga, atualize a pasta render-server.`)); return;
      }
      try {
        const job = JSON.parse(xhr.responseText) as ServerJob;
        if (job.id !== id || !["na fila", "renderizando", "concluido", "erro"].includes(job.status)) throw new Error("Resposta do servidor inválida");
        resolve(job);
      } catch (e) { reject(e); }
    };
    xhr.send(fd);
  });
}

export async function prepararOverlay(p: OverlayProject, engine: Engine) {
  const overlays = p.overlays.filter((o) => o.html);
  const fd = new FormData();
  fd.append("manifest", JSON.stringify({ nome: p.nome, engine, largura: p.largura, altura: p.altura, duracao: p.duracao, fps: 30,
    overlays: overlays.map((o) => ({ inicio: o.inicio, fim: o.fim, camera: o.camera, html: o.html ? prepareSceneHtml(o.html, p.largura, p.altura) : "" })) }));
  fd.append("video", p.video, "video");
  if (p.sons) {
    const ev = overlays.flatMap((o) => (o.sons ?? []).map((s) => ({ t: o.inicio + s.t, tipo: s.tipo })));
    if (ev.length) fd.append("sfx", await renderTrilhaWav(ev, [], p.duracao), "sfx.wav");
  }
  return fd;
}

/** Motion IA: cada cena vira uma camada em tela cheia, em sequência, com voz e efeitos. */
export async function prepararMotion(p: Project, engine: Engine) {
  let t = 0;
  const camadas = p.cenas.flatMap((c) => {
    if (!c.html) return [];
    const o = { inicio: t, fim: t + c.duracao, camera: "nenhum", html: prepareSceneHtml(c.html, p.config.largura, p.config.altura), cena: c }; t += c.duracao; return [o];
  });
  if (!t) throw new Error("O projeto não tem cenas prontas para renderizar");
  const fd = new FormData();
  fd.append("manifest", JSON.stringify({ nome: p.config.nome, engine, largura: p.config.largura, altura: p.config.altura, duracao: t, fps: 30,
    overlays: camadas.map(({ cena: _c, ...o }) => o) }));
  const ev = p.config.sons ? camadas.flatMap((o) => (o.cena.sons ?? []).map((s) => ({ t: o.inicio + s.t, tipo: s.tipo }))) : [];
  const falas = p.config.voz ? camadas.flatMap((o) => o.cena.audio ? [{ t: o.inicio, blob: o.cena.audio }] : []) : [];
  if (ev.length || falas.length) fd.append("sfx", await renderTrilhaWav(ev, falas, t), "trilha.wav");
  return fd;
}
