import { mkdir, readFile, writeFile, rename, readdir, rm } from "node:fs/promises";
import { join } from "node:path";

export const validJobId = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);

/** Disk is the source of truth; no browser or HTTP request owns a running render. */
export class RenderQueue {
  constructor(root, render, concurrency = 1) {
    this.root = root;
    this.render = render;
    this.concurrency = Math.max(1, Math.min(4, Number(concurrency) || 1));
    this.jobs = new Map();
    this.active = 0;
    this.pendingIds = new Set();
  }
  directory(id) {
    if (!validJobId(id)) throw new Error("Identificador de renderização inválido");
    return join(this.root, id);
  }
  async persist(job) {
    const dir = this.directory(job.id);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, "job.json.tmp"), JSON.stringify(job));
    await rename(join(dir, "job.json.tmp"), join(dir, "job.json"));
    this.jobs.set(job.id, job);
  }
  async init() {
    await mkdir(this.root, { recursive: true });
    for (const id of await readdir(this.root)) {
      if (!validJobId(id)) continue;
      try {
        const job = JSON.parse(await readFile(join(this.directory(id), "job.json"), "utf8"));
        if (job.status === "renderizando") {
          job.status = "na fila"; job.progresso = 0; job.etapa = "Retomando após reinício";
          delete job.inicio;
        }
        await this.persist(job);
      } catch (e) { console.warn(`Job ${id}: metadados indisponíveis (${e.message})`); }
    }
    this.pump();
  }
  get(id) { return this.jobs.get(id); }
  async submit(id, manifest, prepare) {
    this.directory(id);
    if (this.jobs.has(id)) return this.jobs.get(id);
    if (this.pendingIds.has(id)) throw new Error("Este envio já está em andamento");
    this.pendingIds.add(id);
    const dir = this.directory(id);
    try {
      await mkdir(dir, { recursive: true });
      await prepare(dir);
      await writeFile(join(dir, "manifest.json"), JSON.stringify(manifest));
      const job = { id, status: "na fila", progresso: 0, etapa: "Aguardando renderização", criadoEm: Date.now(), nome: manifest.nome || "video", engine: manifest.engine };
      await this.persist(job);
      this.pump();
      return this.get(id);
    } finally { this.pendingIds.delete(id); }
  }
  pump() {
    while (this.active < this.concurrency) {
      const job = [...this.jobs.values()].filter((j) => j.status === "na fila").sort((a, b) => a.criadoEm - b.criadoEm)[0];
      if (!job) return;
      // Reserve synchronously before any filesystem await.
      this.jobs.set(job.id, { ...job, status: "renderizando" });
      this.active++;
      void this.execute(job).finally(() => { this.active--; this.pump(); });
    }
  }
  async execute(job) {
    let current = { ...job, status: "renderizando", inicio: Date.now(), progresso: 1, etapa: "Preparando renderização" };
    // Serialize atomic metadata writes; progress cannot overwrite completion.
    let writes = Promise.resolve();
    const update = (progresso, etapa) => {
      current = { ...current, progresso: Math.max(current.progresso, Math.min(99, Math.round(progresso))), etapa };
      const snapshot = current;
      this.jobs.set(job.id, snapshot);
      writes = writes.then(() => this.persist(snapshot));
    };
    try {
      await this.persist(current);
      const dir = this.directory(job.id);
      const manifest = JSON.parse(await readFile(join(dir, "manifest.json"), "utf8"));
      await this.render(manifest, dir, update);
      await writes;
      current = { ...current, status: "concluido", progresso: 100, etapa: "MP4 pronto para baixar", fim: Date.now() };
    } catch (e) {
      await writes.catch(() => {});
      current = { ...current, status: "erro", etapa: "Renderização interrompida", erro: String(e?.message || e), fim: Date.now() };
    }
    await this.persist(current).catch((e) => console.error("Não foi possível salvar o estado do job", e));
  }
  async retry(id) {
    const job = this.get(id);
    if (!job || job.status !== "erro") throw new Error("Somente trabalhos com erro podem ser repetidos");
    const next = { ...job, status: "na fila", progresso: 0, etapa: "Aguardando renderização" };
    delete next.erro; delete next.inicio; delete next.fim;
    await this.persist(next);
    this.pump();
    return this.get(id);
  }
  async remove(id) {
    const job = this.get(id);
    if (job?.status === "renderizando" || job?.status === "na fila" || this.pendingIds.has(id)) throw new Error("Aguarde a renderização terminar antes de remover");
    await rm(this.directory(id), { recursive: true, force: true });
    this.jobs.delete(id);
  }
}

export function validateManifest(m) {
  if (!m || !["ffmpeg", "hyperframes"].includes(m.engine)) throw new Error("Motor inválido");
  for (const key of ["largura", "altura"]) {
    if (!Number.isInteger(m[key]) || m[key] < 2 || m[key] > 4096 || m[key] % 2) throw new Error("Dimensões devem ser pares, entre 2 e 4096");
  }
  if (!Number.isFinite(m.duracao) || m.duracao <= 0 || m.duracao > 3600) throw new Error("Duração inválida (máximo 1 hora)");
  m.fps ??= 30;
  if (!Number.isInteger(m.fps) || m.fps < 1 || m.fps > 60) throw new Error("FPS inválido");
  if (!Array.isArray(m.overlays) || m.overlays.length > 300) throw new Error("Camadas inválidas");
  for (const o of m.overlays) {
    if (!Number.isFinite(o.inicio) || !Number.isFinite(o.fim) || o.inicio < 0 || o.fim <= o.inicio || o.fim > m.duracao + 0.001 || typeof o.html !== "string" || o.html.length > 2_000_000) throw new Error("Camada inválida");
    if (!["nenhum", "punch", "zoom-in", "zoom-out", "pan-esquerda", "pan-direita", undefined].includes(o.camera)) throw new Error("Câmera inválida");
  }
  if (m.audio !== undefined) {
    if (!m.audio || typeof m.audio !== "object" || !m.audio.video || !Array.isArray(m.audio.clips) || m.audio.clips.length > 200) throw new Error("Áudio do editor inválido");
    for (const settings of [m.audio.video, ...m.audio.clips]) {
      if (!Number.isFinite(settings.volume) || settings.volume < 0 || settings.volume > 4 || !Number.isFinite(settings.grave) || settings.grave < -24 || settings.grave > 24 || !Number.isFinite(settings.agudo) || settings.agudo < -24 || settings.agudo > 24) throw new Error("Volume ou equalização inválidos");
    }
    if (typeof m.audio.video.mudo !== "boolean") throw new Error("Áudio do vídeo inválido");
    for (let i = 0; i < m.audio.clips.length; i++) {
      const c = m.audio.clips[i];
      if (c.arquivo !== `audio_${i}` || !Number.isFinite(c.inicio) || c.inicio < 0 || !Number.isFinite(c.offset) || c.offset < 0 || !Number.isFinite(c.duracao) || c.duracao < 0.05 || c.inicio + c.duracao > m.duracao + 0.001 || !Number.isFinite(c.sourceDuration) || c.offset + c.duracao > c.sourceDuration + 0.01) throw new Error("Corte de áudio inválido");
      if (c.mediaId !== undefined && !/^[0-9a-f-]{36}$/i.test(c.mediaId)) throw new Error("Mídia remota inválida");
      if (c.stem !== undefined && !["original", "instrumental"].includes(c.stem)) throw new Error("Faixa de áudio inválida");
    }
  }
  return m;
}