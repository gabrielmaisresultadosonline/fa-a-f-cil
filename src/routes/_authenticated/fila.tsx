import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Trash2, CheckCircle2, Clock, AlertTriangle, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/motion/AppShell";
import { JobDownload, JobProgress, JobRetry } from "@/components/motion/RenderStatus";
import { Button } from "@/components/ui/button";
import { listJobs, onQueue, removeJob, type Job } from "@/lib/queue";

export const Route = createFileRoute("/_authenticated/fila")({
  head: () => ({ meta: [
    { title: "Fila de renderização — MotionMRO" },
    { name: "description", content: "Acompanhe e baixe os vídeos que estão sendo renderizados." },
    { property: "og:title", content: "Fila de renderização — MotionMRO" },
    { property: "og:description", content: "Acompanhe e baixe os vídeos que estão sendo renderizados." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Fila,
});

const ICON = { enviando: UploadCloud, "na fila": Clock, renderizando: Loader2, concluido: CheckCircle2, erro: AlertTriangle };
const COR = { enviando: "text-primary", "na fila": "text-muted-foreground", renderizando: "text-primary animate-spin", concluido: "text-success", erro: "text-destructive" };

function Fila() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [agora, setAgora] = useState(Date.now());
  useEffect(() => { const up = () => listJobs().then(setJobs); up(); const t = setInterval(() => setAgora(Date.now()), 1000); const off = onQueue(up); return () => { clearInterval(t); off(); }; }, []);
  const dur = (j: Job) => { const s = Math.round(((j.fim ?? agora) - (j.inicio ?? agora)) / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
  return (
    <AppShell title="Fila de renderização">
      <p className="mb-5 max-w-3xl text-sm text-muted-foreground">Após a confirmação do envio, pode minimizar ou fechar o navegador. O servidor continua renderizando e guarda o MP4 para você baixar depois. Mantenha o computador ou a VPS do servidor ligado.</p>
      <div className="overflow-hidden border-y border-border">
        {jobs.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">A fila está vazia.</p>}
        {jobs.map((j, i) => {
          const I = ICON[j.status];
          return (
            <div key={j.id} className="animate-fade-up flex flex-wrap items-center gap-4 border-b border-border p-4 last:border-0" style={{ animationDelay: `${i * 40}ms` }}>
              <I className={`h-5 w-5 shrink-0 ${COR[j.status]}`} />
               <div className="min-w-0 basis-[calc(100%-3rem)] sm:basis-0 sm:flex-1">
                <div className="truncate font-medium">{j.nome}</div>
                <div className="font-mono text-xs text-muted-foreground">{j.modulo === "motion" ? "Motion IA" : "Video Overlay"} · {j.engine === "ffmpeg" ? "FFmpeg" : "HyperFrames"} · {j.status}{j.inicio ? ` · ${dur(j)}` : ""}</div>
                {j.erro && <div className="mt-1 text-xs text-destructive">{j.erro}</div>}
                 {j.conexao && <div className="mt-1 text-xs text-destructive">{j.conexao}</div>}
                 {(j.status === "enviando" || j.status === "renderizando" || j.status === "na fila" || j.status === "concluido") && <div className="mt-3"><JobProgress job={j} /></div>}
              </div>
               <JobDownload job={j} />
               {j.status === "erro" && <JobRetry job={j} />}
               {(j.status === "erro" || j.status === "concluido") && <Button variant="ghost" size="icon" aria-label={`Remover ${j.nome}`} title="Remover trabalho e arquivo salvo" onClick={async () => { if (j.remoto && !window.confirm("Remover este trabalho e o MP4 salvo no servidor?")) return; try { await removeJob(j.id); } catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível remover"); } }}><Trash2 className="text-muted-foreground" /></Button>}
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}
