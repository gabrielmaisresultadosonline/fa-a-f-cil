import { get, set, del, keys } from "idb-keyval";
import { getOverlay } from "./overlays";
import { getProject } from "./projects";
import { renderMotionNoServidor, renderNoServidor, type Engine } from "./serverRender";

export interface Job {
  id: string; modulo: "motion" | "overlay"; alvoId: string; nome: string; engine: Engine;
  status: "na fila" | "renderizando" | "concluido" | "erro"; criadoEm: number; inicio?: number; fim?: number;
  erro?: string | undefined; resultado?: Blob;
}
const P = "job:";
const listeners = new Set<() => void>();
export function onQueue(f: () => void) { listeners.add(f); return () => { listeners.delete(f); }; }
const emit = () => listeners.forEach((f) => f());

export async function saveJob(j: Job) { await set(P + j.id, j); emit(); }
export async function removeJob(id: string) { await del(P + id); emit(); }
export async function listJobs() {
  const ks = (await keys()).filter((k) => String(k).startsWith(P));
  return ((await Promise.all(ks.map((k) => get<Job>(k)))).filter(Boolean) as Job[]).sort((a, b) => a.criadoEm - b.criadoEm);
}
export async function enfileirar(j: Pick<Job, "modulo" | "alvoId" | "nome" | "engine">) {
  await saveJob({ ...j, id: crypto.randomUUID(), status: "na fila", criadoEm: Date.now() });
  void processarFila();
}

let rodando = false;
/** Processa a fila uma renderização por vez enquanto o MotionMRO estiver aberto. */
export async function processarFila() {
  if (rodando) return; rodando = true;
  try {
    // trabalhos interrompidos (aba fechada) voltam para a fila
    for (const j of await listJobs()) if (j.status === "renderizando") await saveJob({ ...j, status: "na fila" });
    for (;;) {
      const j = (await listJobs()).find((x) => x.status === "na fila");
      if (!j) break;
      await saveJob({ ...j, status: "renderizando", inicio: Date.now(), erro: undefined });
      try {
        let blob: Blob;
        if (j.modulo === "overlay") { const p = await getOverlay(j.alvoId); if (!p) throw new Error("Projeto apagado"); blob = await renderNoServidor(p, j.engine); }
        else { const p = await getProject(j.alvoId); if (!p) throw new Error("Projeto apagado"); blob = await renderMotionNoServidor(p, j.engine); }
        await saveJob({ ...j, status: "concluido", fim: Date.now(), resultado: blob });
      } catch (e) {
        await saveJob({ ...j, status: "erro", fim: Date.now(), erro: e instanceof Error ? e.message : String(e) });
      }
    }
  } finally { rodando = false; }
}
