import { get, set, del, keys } from "idb-keyval";
import type { Som } from "./sfx";

export interface Segmento { inicio: number; fim: number; texto: string }
export interface Overlay { id: string; inicio: number; fim: number; tipo: string; texto: string; posicao: string; modo?: "texto" | "escurecido" | "tela-cheia"; descricao: string; camera: string; sons?: Som[]; html?: string }
export interface OverlayProject {
  id: string; nome: string; criadoEm: number; atualizadoEm: number;
  video: Blob; largura: number; altura: number; duracao: number; sons: boolean;
  transcricao?: Segmento[]; estilo?: string; overlays: Overlay[];
  status: "rascunho" | "produzindo" | "pronto" | "erro"; log: { t: number; msg: string }[];
}
const P = "overlay:";
export async function saveOverlay(p: OverlayProject) { p.atualizadoEm = Date.now(); await set(P + p.id, p); }
export async function getOverlay(id: string) { return (await get<OverlayProject>(P + id)) ?? null; }
export async function deleteOverlay(id: string) { await del(P + id); }
export async function listOverlays() {
  const ks = (await keys()).filter((k) => String(k).startsWith(P));
  return ((await Promise.all(ks.map((k) => get<OverlayProject>(k)))).filter(Boolean) as OverlayProject[]).sort((a, b) => b.atualizadoEm - a.atualizadoEm);
}
