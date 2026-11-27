import { servidorUrl } from "./serverRender";
import { renderFetch } from "./renderAuth";

export interface RemoteAudio {
  id: string;
  nome: string;
  duracao: number;
  instrumentalDisponivel?: boolean;
  faixaSemVoz?: { inicio: number; fim: number };
}

async function responseJson(response: Response) {
  const data = await response.json().catch(() => ({})) as { erro?: string };
  if (!response.ok) throw new Error(data.erro || "O servidor não conseguiu processar o áudio");
  return data;
}

export type ProgressFn = (percent: number) => void;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function downloadYoutubeAudio(url: string, onProgress: ProgressFn = () => {}): Promise<RemoteAudio> {
  const response = await renderFetch(`${servidorUrl()}/media/youtube`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }),
  });
  const start = await responseJson(response) as RemoteAudio & { tarefa?: string };
  if (!start.tarefa) return start; // older servers answer with the media directly
  onProgress(0);
  for (let i = 0; i < 1200; i++) {
    await wait(1500);
    const status = await responseJson(await renderFetch(`${servidorUrl()}/media/tarefa/${start.tarefa}`)) as { progresso?: number; resultado?: RemoteAudio };
    onProgress(status.progresso || 0);
    if (status.resultado) return status.resultado;
  }
  throw new Error("O download demorou demais. Tente novamente.");
}

export async function separateVocals(mediaId: string, onProgress: ProgressFn = () => {}, range?: { inicio: number; fim: number }): Promise<RemoteAudio> {
  // The server separates in the background; poll until the instrumental exists (up to ~40 min).
  for (let i = 0; i < 800; i++) {
    const response = await renderFetch(`${servidorUrl()}/media/${mediaId}/separate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(range ?? {}) });
    const data = await responseJson(response) as RemoteAudio & { separando?: boolean; progresso?: number };
    if (!data.separando) { onProgress(100); return data; }
    onProgress(data.progresso || 0);
    await wait(3000);
  }
  throw new Error("A remoção de voz demorou demais. Tente novamente.");
}

/** Only audio leaves the user's computer; the uploaded record retains the existing UVR flow. */
export async function uploadLocalAudio(file: File): Promise<RemoteAudio> {
  const form = new FormData();
  form.append('audio', file);
  const response = await renderFetch(`${servidorUrl()}/media/upload`, { method: 'POST', body: form });
  return await responseJson(response) as RemoteAudio;
}

export function audioDuration(blob: Blob): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = document.createElement("audio");
    const url = URL.createObjectURL(blob);
    const done = () => URL.revokeObjectURL(url);
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      const duration = audio.duration;
      done();
      if (Number.isFinite(duration) && duration > 0) resolve(duration);
      else reject(new Error("Não foi possível ler a duração do áudio"));
    };
    audio.onerror = () => { done(); reject(new Error("Formato de áudio não suportado pelo navegador")); };
    audio.src = url;
  });
}
