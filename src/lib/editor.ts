import { createId } from "./uuid";
import { saveCloud, listCloud } from "./cloudRepository";
import { getOverlay } from "./overlays";
import { getProject } from "./projects";
import { renderSfxWav } from "./sfx";
import { getStudioSettings, SERVIDOR_PADRAO } from "./settings";

export type EditorModule = "motion" | "overlay";
export type TrackKind = "video" | "efeitos" | "musica" | "gravacao" | "audio";
export type AudioStem = "original" | "instrumental";

export interface EditorClip {
  id: string;
  assetId: string;
  nome: string;
  inicio: number;
  offset: number;
  duracao: number;
  sourceDuration: number;
  volume: number;
  grave: number;
  agudo: number;
  blob?: Blob;
  mediaId?: string;
  servidor?: string;
  stem?: AudioStem;
  /** Source range (seconds) that has vocals removed in the instrumental stem. */
  faixaSemVoz?: { inicio: number; fim: number };
}

export interface EditorTrack {
  id: string;
  tipo: TrackKind;
  nome: string;
  volume: number;
  grave: number;
  agudo: number;
  mudo: boolean;
  clips: EditorClip[];
}

export interface EditorProject {
  id: string;
  modulo: EditorModule;
  alvoId: string;
  nome: string;
  largura: number;
  altura: number;
  duracao: number;
  criadoEm: number;
  atualizadoEm: number;
  tracks: EditorTrack[];
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

function track(tipo: TrackKind, nome: string, clips: EditorClip[] = []): EditorTrack {
  return { id: createId(), tipo, nome, volume: 1, grave: 0, agudo: 0, mudo: false, clips };
}

export function clipUrl(clip: EditorClip) {
  if (!clip.mediaId) return "";
  return `${(clip.servidor || getStudioSettings().servidor || SERVIDOR_PADRAO).replace(/\/+$/, "")}/media/${clip.mediaId}/audio?stem=${clip.stem === "instrumental" ? "instrumental" : "original"}`;
}

export async function getEditor(modulo: EditorModule, alvoId: string) {
  return (await listCloud<EditorProject>("editor")).find((p)=>p.modulo===modulo && p.alvoId===alvoId) ?? null;
}

export async function saveEditor(project: EditorProject) {
  project.atualizadoEm = Date.now();
  await saveCloud("editor",project.id,project.nome,project);
}

export async function getOrCreateEditor(modulo: EditorModule, alvoId: string): Promise<EditorProject> {
  const saved = await getEditor(modulo, alvoId);
  if (saved) return saved;
  let nome: string, largura: number, altura: number, duracao: number;
  let eventos: { t: number; tipo: string }[] = [];
  if (modulo === "motion") {
    const p = await getProject(alvoId);
    if (!p) throw new Error("Projeto Motion não encontrado");
    const scenes = p.cenas.filter((c) => c.html);
    if (!scenes.length) throw new Error("Gere a prévia antes de abrir o editor");
    nome = p.config.nome; largura = p.config.largura; altura = p.config.altura;
    duracao = scenes.reduce((sum, c) => sum + c.duracao, 0);
    if (p.config.sons) {
      let t = 0;
      for (const cena of scenes) {
        eventos.push(...(cena.sons ?? []).map((s) => ({ t: t + s.t, tipo: s.tipo })));
        t += cena.duracao;
      }
    }
  } else {
    const p = await getOverlay(alvoId);
    if (!p) throw new Error("Projeto Overlay não encontrado");
    if (!p.overlays.some((o) => o.html)) throw new Error("Gere a prévia antes de abrir o editor");
    nome = p.nome; largura = p.largura; altura = p.altura; duracao = p.duracao;
    if (p.sons) eventos = p.overlays.flatMap((o) => (o.sons ?? []).map((s) => ({ t: o.inicio + s.t, tipo: s.tipo })));
  }
  const tracks = [track("video", "Vídeo principal")];
  if (eventos.length) {
    const blob = await renderSfxWav(eventos, duracao);
    tracks.push(track("efeitos", "Efeitos sonoros", [{
      id: createId(), assetId: createId(), nome: "Efeitos criados pela IA",
      inicio: 0, offset: 0, duracao, sourceDuration: duracao, volume: 1, grave: 0, agudo: 0, blob,
    }]));
  } else tracks.push(track("efeitos", "Efeitos sonoros"));
  tracks.push(track("musica", "Música"), track("gravacao", "Gravações"));
  const editor: EditorProject = {
    id: createId(), modulo, alvoId, nome, largura, altura, duracao,
    criadoEm: Date.now(), atualizadoEm: Date.now(), tracks,
  };
  await saveEditor(editor);
  return editor;
}

export function addClip(project: EditorProject, input: {
  nome: string; sourceDuration: number; inicio?: number; blob?: Blob; mediaId?: string;
  servidor?: string; stem?: AudioStem; tipo?: Exclude<TrackKind, "video">; novaFaixa?: boolean;
}): EditorProject {
  const inicio = clamp(input.inicio ?? 0, 0, Math.max(0, project.duracao - 0.1));
  const duracao = Math.min(input.sourceDuration, project.duracao - inicio);
  if (!Number.isFinite(duracao) || duracao < 0.1) throw new Error("O áudio precisa ter pelo menos 0,1 segundo dentro do vídeo");
  const clip: EditorClip = {
    id: createId(), assetId: createId(), nome: input.nome || "Áudio",
    inicio, offset: 0, duracao, sourceDuration: input.sourceDuration,
    volume: 1, grave: 0, agudo: 0,
    ...(input.blob ? { blob: input.blob } : {}),
    ...(input.mediaId ? { mediaId: input.mediaId } : {}),
    ...(input.servidor ? { servidor: input.servidor } : {}),
    ...(input.stem ? { stem: input.stem } : {}),
  };
  const tracks = project.tracks.map((t) => ({ ...t, clips: [...t.clips] }));
  if (input.novaFaixa) tracks.push(track(input.tipo ?? "audio", clip.nome, [clip]));
  else {
    let target = tracks.find((t) => t.tipo === (input.tipo ?? "audio"));
    if (!target) { target = track(input.tipo ?? "audio", input.tipo === "gravacao" ? "Gravações" : "Áudios"); tracks.push(target); }
    target.clips.push(clip);
  }
  return { ...project, tracks };
}

function replaceClip(project: EditorProject, id: string, replace: (clip: EditorClip) => EditorClip): EditorProject {
  return { ...project, tracks: project.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => c.id === id ? replace(c) : c) })) };
}

export function updateClip(project: EditorProject, id: string, patch: Partial<Pick<EditorClip, "volume" | "grave" | "agudo" | "nome" | "stem">>): EditorProject {
  return replaceClip(project, id, (c) => ({ ...c, ...patch,
    volume: clamp(patch.volume ?? c.volume, 0, 2), grave: clamp(patch.grave ?? c.grave, -12, 12), agudo: clamp(patch.agudo ?? c.agudo, -12, 12) }));
}

export function updateTrack(project: EditorProject, id: string, patch: Partial<Pick<EditorTrack, "volume" | "grave" | "agudo" | "mudo" | "nome">>): EditorProject {
  return { ...project, tracks: project.tracks.map((t) => t.id === id ? { ...t, ...patch,
    volume: clamp(patch.volume ?? t.volume, 0, 2), grave: clamp(patch.grave ?? t.grave, -12, 12), agudo: clamp(patch.agudo ?? t.agudo, -12, 12) } : t) };
}

export function moveClipTo(project: EditorProject, id: string, inicio: number): EditorProject {
  return replaceClip(project, id, (c) => ({ ...c, inicio: clamp(inicio, 0, Math.max(0, project.duracao - c.duracao)) }));
}

export function trimClipTo(project: EditorProject, id: string, edge: "inicio" | "fim", time: number): EditorProject {
  return replaceClip(project, id, (c) => {
    if (edge === "inicio") {
      const next = clamp(time, c.inicio - c.offset, Math.min(c.inicio + c.duracao - 0.1, project.duracao));
      const delta = next - c.inicio;
      return { ...c, inicio: next, offset: c.offset + delta, duracao: c.duracao - delta };
    }
    const end = clamp(time, c.inicio + 0.1, Math.min(project.duracao, c.inicio - c.offset + c.sourceDuration));
    return { ...c, duracao: end - c.inicio };
  });
}

/** Choose which part of the source plays (offset) and for how long, kept inside the video. */
export function setClipWindow(project: EditorProject, id: string, offset: number, duracao: number): EditorProject {
  return replaceClip(project, id, (c) => {
    const nextOffset = clamp(offset, 0, Math.max(0, c.sourceDuration - 0.1));
    const maxLen = Math.min(c.sourceDuration - nextOffset, project.duracao - c.inicio);
    return { ...c, offset: nextOffset, duracao: clamp(duracao, Math.min(0.1, maxLen), Math.max(0.1, maxLen)) };
  });
}

/** True when the clip's current window lies inside the range whose vocals were removed. */
export function vocalsRemovedFor(clip: EditorClip) {
  if (clip.stem !== "instrumental") return false;
  if (!clip.faixaSemVoz) return true;
  return clip.faixaSemVoz.inicio <= clip.offset + 0.05 && clip.faixaSemVoz.fim >= clip.offset + clip.duracao - 0.05;
}

export function splitClip(project: EditorProject, id: string, time: number): EditorProject {
  const found = project.tracks.flatMap((t) => t.clips).find((c) => c.id === id);
  if (!found || time <= found.inicio + 0.05 || time >= found.inicio + found.duracao - 0.05) return project;
  const leftDuration = time - found.inicio;
  const right: EditorClip = { ...found, id: createId(), nome: `${found.nome} (2)`, inicio: time, offset: found.offset + leftDuration, duracao: found.duracao - leftDuration };
  return { ...project, tracks: project.tracks.map((t) => ({ ...t, clips: t.clips.flatMap((c) => c.id === id ? [{ ...c, duracao: leftDuration }, right] : [c]) })) };
}

export function deleteClip(project: EditorProject, id: string): EditorProject {
  return { ...project, tracks: project.tracks.map((t) => ({ ...t, clips: t.clips.filter((c) => c.id !== id) })) };
}

export function findClip(project: EditorProject, id?: string) {
  if (!id) return undefined;
  for (const t of project.tracks) {
    const clip = t.clips.find((c) => c.id === id);
    if (clip) return { clip, track: t };
  }
  return undefined;
}

export function clipMix(clip: EditorClip, track: EditorTrack) {
  return {
    volume: clamp(clip.volume * track.volume, 0, 4),
    grave: clamp(clip.grave + track.grave, -24, 24),
    agudo: clamp(clip.agudo + track.agudo, -24, 24),
  };
}
