import { saveCloud, getCloud, deleteCloud, listCloud } from "./cloudRepository";
import type { Som } from "./sfx";

export interface Segmento { inicio: number; fim: number; texto: string }
export interface Overlay { id: string; inicio: number; fim: number; tipo: string; texto: string; posicao: string; modo?: "texto" | "escurecido" | "tela-cheia"; descricao: string; camera: string; sons?: Som[]; html?: string }
export interface OverlayProject {
  id: string; nome: string; criadoEm: number; atualizadoEm: number;
  video: Blob; largura: number; altura: number; duracao: number; sons: boolean;
  transcricao?: Segmento[]; estilo?: string; overlays: Overlay[];
  status: "rascunho" | "produzindo" | "pronto" | "erro"; log: { t: number; msg: string }[];
}
export async function saveOverlay(p: OverlayProject, onUpload?: (percent: number) => void) { p.atualizadoEm = Date.now(); await saveCloud("overlay",p.id,p.nome,p,onUpload); }
export async function getOverlay(id: string) { return getCloud<OverlayProject>("overlay",id); }
export async function deleteOverlay(id: string) { await deleteCloud("overlay",id); }
export async function listOverlays() {
  return listCloud<OverlayProject>("overlay");
}
