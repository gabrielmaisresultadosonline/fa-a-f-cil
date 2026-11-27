import { useEffect, useState } from "react";
import { Download, Loader2, RotateCcw, ListVideo, CheckCircle2, AlertTriangle } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { downloadJobUrl, listJobs, onQueue, retryJob, type Job } from "@/lib/queue";
import { download } from "@/lib/recorder";
import { renderDownload } from "@/lib/renderAuth";

export function JobProgress({ job }: { job: Job }) {
  const value = job.status === "concluido" ? 100 : job.status === "enviando" ? job.envio ?? 0 : job.progresso ?? 0;
  return <div className="space-y-2">
    <div className="flex items-start justify-between gap-3 text-xs">
      <span className="min-w-0 text-muted-foreground">{job.etapa || job.status}</span>
      <span className="shrink-0 font-mono tabular-nums text-foreground">{Math.round(value)}%</span>
    </div>
    <progress aria-label={job.status === "enviando" ? "Envio dos arquivos" : "Progresso da renderização"} max={100} value={value} className="render-progress h-1.5 w-full" />
  </div>;
}

export function JobDownload({ job }: { job: Job }) {
  const href = downloadJobUrl(job);
  if (href) return <Button size="sm" onClick={()=>void renderDownload(href,`${job.nome}.mp4`).catch((e)=>toast.error(e.message))}><Download />Salvar / baixar MP4</Button>;
  if (job.resultado) return <Button size="sm" onClick={() => { if (job.resultado) download(job.resultado, `${job.nome.replace(/\W+/g, "_")}.mp4`); }}><Download />Baixar MP4</Button>;
  return null;
}

export function JobRetry({ job }: { job: Job }) {
  const [busy, setBusy] = useState(false);
  if(job.expirado)return null;
  return <Button variant="outline" size="sm" disabled={busy} onClick={async () => {
    setBusy(true);
    try { await retryJob(job); } catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível repetir"); }
    finally { setBusy(false); }
  }}>{busy ? <Loader2 className="animate-spin" /> : <RotateCcw />}Tentar de novo</Button>;
}

export function RenderStatus({ alvoId }: { alvoId: string }) {
  const [job, setJob] = useState<Job>();
  useEffect(() => {
    const update = () => listJobs().then((jobs) => setJob(jobs.filter((j) => j.alvoId === alvoId).at(-1)));
    void update(); const off = onQueue(update); return off;
  }, [alvoId]);
  if (!job) return null;
  return <section aria-label="Renderização do projeto" className="mb-5 space-y-3 border-b border-border pb-5">
    <div className="flex flex-wrap items-center gap-3">
      {job.status === "concluido" ? <CheckCircle2 className="h-4 w-4 text-success" /> : job.status === "erro" ? <AlertTriangle className="h-4 w-4 text-destructive" /> : <Loader2 className="h-4 w-4 animate-spin text-primary" />}
      <h2 className="text-sm font-semibold">{job.status === "concluido" ? "Vídeo salvo no servidor" : job.status === "enviando" ? "Enviando projeto" : job.status === "erro" ? "Renderização com erro" : "Renderização em segundo plano"}</h2>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <JobDownload job={job} />
        {job.status === "erro" && <JobRetry job={job} />}
        <Button variant="ghost" size="sm" asChild><Link to="/fila"><ListVideo />Ver fila</Link></Button>
      </div>
    </div>
    {job.status !== "erro" && <JobProgress job={job} />}
    {job.erro && <p className="break-words text-xs text-destructive">{job.erro}</p>}
    {job.conexao && <p className="text-xs text-destructive">{job.conexao}</p>}
    <p className="text-xs text-muted-foreground">{job.status === "enviando" ? "Aguarde a confirmação do envio antes de fechar o navegador." : job.status === "concluido" ? "Baixe o MP4 em até dois dias após a conclusão. Depois ele é excluído; o projeto permanece salvo." : job.remoto ? "Pode minimizar ou fechar o navegador. Mantenha o servidor ligado." : "O envio precisa ser confirmado pelo servidor."}</p>
  </section>;
}