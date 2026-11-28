import { resolveRenderBase } from "./settings";
import { createId } from "./uuid";
import { saveCloud, getCloud, deleteCloud, listCloud } from "./cloudRepository";
import { getOverlay } from "./overlays";
import { getProject } from "./projects";
import { enviarJob, prepararEditor, prepararMotion, prepararOverlay, serverRequest, servidorUrl, type Engine, type ServerJob } from "./serverRender";
import { getEditor } from "./editor";

export interface Job {
  expirado?:boolean;
  id: string; modulo: "motion" | "overlay"; alvoId: string; nome: string; engine: Engine; editorId?: string;
  status: "enviando" | "na fila" | "renderizando" | "concluido" | "erro"; criadoEm: number; inicio?: number; fim?: number;
  erro?: string | undefined; resultado?: Blob;
  servidor?: string; remoto?: boolean; progresso?: number; envio?: number; etapa?: string;
  conexao?: string | undefined;
}
const uploads = new Set<string>();
const listeners = new Set<() => void>();
export function onQueue(f: () => void) { listeners.add(f); return () => { listeners.delete(f); }; }
const emit = () => listeners.forEach((f) => f());

export async function saveJob(j: Job) { await saveCloud("job",j.id,j.nome,j); emit(); }
export async function removeJob(id: string) {
  const job = await getCloud<Job>("job",id);
  if (job?.remoto && job.servidor) await serverRequest(`${resolveRenderBase(job.servidor)}/jobs/${id}`, { method: "DELETE" });
  await deleteCloud("job",id); emit();
}
export async function listJobs() {
  return (await listCloud<Job>("job")).sort((a,b)=>a.criadoEm-b.criadoEm);
}
export async function enfileirar(j: Pick<Job, "modulo" | "alvoId" | "nome" | "engine" | "editorId">) {
  const job: Job = { ...j, id: createId(), status: "enviando", criadoEm: Date.now(), servidor: servidorUrl(), progresso: 0, envio: 0, etapa: "Preparando vídeo e áudio" };
  await saveJob(job);
  return enviar(job);
}

async function enviar(job: Job): Promise<Job> {
  uploads.add(job.id);
  const servidor = job.servidor || servidorUrl();
  let latest = { ...job, servidor, status: "enviando" as Job["status"], erro: undefined, conexao: undefined };
  await saveJob(latest);
  // Serialize upload notifications so late IndexedDB writes cannot replace acceptance.
  let writes = Promise.resolve();
  try {
    let fd: FormData;
    if (job.editorId) {
      const editor = await getEditor(job.modulo, job.alvoId);
      if (!editor || editor.id !== job.editorId) throw new Error("Editor apagado ou alterado");
      fd = await prepararEditor(editor, job.engine);
    } else if (job.modulo === "overlay") {
      const p = await getOverlay(job.alvoId); if (!p) throw new Error("Projeto apagado");
      fd = await prepararOverlay(p, job.engine);
    } else {
      const p = await getProject(job.alvoId); if (!p) throw new Error("Projeto apagado");
      fd = await prepararMotion(p, job.engine);
    }
    const remote = await enviarJob(fd, job.id, servidor, (envio) => {
      latest = { ...latest, envio, etapa: envio === 100 ? "Confirmando recebimento no servidor" : "Enviando arquivos ao servidor" };
      const snapshot = latest;
      writes = writes.then(() => saveJob(snapshot));
    });
    await writes;
    const accepted = mergeRemote(latest, remote);
    await saveJob(accepted);
    return accepted;
  } catch (e) {
    await writes.catch(() => {});
    await saveJob({ ...latest, status: "erro", erro: e instanceof Error ? e.message : String(e), etapa: "Envio não confirmado" });
    throw e;
  } finally { uploads.delete(job.id); }
}

function mergeRemote(job: Job, remote: ServerJob): Job {
  return { ...job, ...remote, remoto: true, envio: 100, conexao: undefined, erro: remote.erro };
}
export function downloadJobUrl(job: Job) {
  return job.remoto && job.servidor && job.status === "concluido" ? `${resolveRenderBase(job.servidor)}/jobs/${job.id}/download` : undefined;
}
export async function retryJob(job: Job) {
  if (job.remoto && job.servidor) {
    const remote = await serverRequest(`${resolveRenderBase(job.servidor)}/jobs/${job.id}/retry`, { method: "POST" });
    await saveJob(mergeRemote(job, remote));
  } else {
    // Idempotent: if the original POST was accepted but the reply was lost, reuses it.
    await enviar(job);
  }
}

let syncing = false;
/** Only reads server state. Rendering itself never depends on this timer. */
export async function processarFila() {
  if (syncing) return;
  syncing = true;
  try {
    const jobs = await listJobs();
    await Promise.all(jobs.filter((j) => !uploads.has(j.id) && j.servidor && !j.resultado && (j.status === "enviando" || j.status === "na fila" || j.status === "renderizando" || j.conexao)).map(async (j) => {
      if (!j.servidor) return;
      try {
        const remote = await serverRequest(`${resolveRenderBase(j.servidor)}/jobs/${j.id}`);
        await saveJob(mergeRemote(j, remote));
      } catch (e) {
        // An upload isn't durable until POST confirmation; don't overwrite its progress.
        if (j.status === "enviando") return;
        await saveJob({ ...j, conexao: e instanceof Error ? e.message : String(e) });
      }
    }));
  } finally { syncing = false; }
}

let observers = 0;
let timer: ReturnType<typeof setInterval> | undefined;
export function acompanharFila() {
  observers++;
  if (!timer) {
    void recuperarEnvios().then(processarFila);
    timer = setInterval(() => { void processarFila(); }, 2000);
    window.addEventListener("focus", atualizar);
    window.addEventListener("online", atualizar);
  }
  return () => {
    observers--;
    if (!observers) { clearInterval(timer); timer = undefined; window.removeEventListener("focus", atualizar); window.removeEventListener("online", atualizar); }
  };
}
const atualizar = () => { void processarFila(); };
async function recuperarEnvios() {
  for (const job of await listJobs()) {
    if (uploads.has(job.id)) continue;
    if (!job.servidor && (job.status === "na fila" || job.status === "renderizando")) {
      await saveJob({ ...job, status: "erro", erro: "Este trabalho pertence à fila antiga. Tente de novo para enviá-lo à fila em segundo plano.", etapa: "Atualização da fila necessária" });
      continue;
    }
    if (job.status !== "enviando") continue;
    try {
      if (!job.servidor) throw new Error("Servidor não definido");
      await saveJob(mergeRemote(job, await serverRequest(`${resolveRenderBase(job.servidor)}/jobs/${job.id}`)));
    } catch {
      await saveJob({ ...job, status: "erro", erro: "O envio foi interrompido. Tente novamente para confirmar ou reenviar ao servidor.", etapa: "Envio não confirmado" });
    }
  }
}
