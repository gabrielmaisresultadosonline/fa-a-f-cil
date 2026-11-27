import { servidorUrl } from "./serverRender";
import { renderFetch } from "./renderAuth";

export interface RemoteAudio {
  id: string;
  nome: string;
  duracao: number;
  instrumentalDisponivel?: boolean;
}

async function responseJson(response: Response) {
  const data = await response.json().catch(() => ({})) as { erro?: string };
  if (!response.ok) throw new Error(data.erro || "O servidor não conseguiu processar o áudio");
  return data;
}

export async function downloadYoutubeAudio(url: string): Promise<RemoteAudio> {
  const response = await renderFetch(`${servidorUrl()}/media/youtube`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }),
  });
  return await responseJson(response) as RemoteAudio;
}

export async function separateVocals(mediaId: string): Promise<RemoteAudio> {
  const response = await renderFetch(`${servidorUrl()}/media/${mediaId}/separate`, { method: "POST" });
  return await responseJson(response) as RemoteAudio;
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
