import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Download, Loader2, RotateCcw, Trash2, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { AppShell } from "@/components/motion/AppShell";
import { listJobs, onQueue, processarFila, removeJob, saveJob, type Job } from "@/lib/queue";
import { download } from "@/lib/recorder";

export const Route = createFileRoute("/fila")({
  head: () => ({ meta: [
    { title: "Fila de renderização — MotionMRO" },
    { name: "description", content: "Acompanhe e baixe os vídeos que estão sendo renderizados." },
    { property: "og:title", content: "Fila de renderização — MotionMRO" },
    { property: "og:description", content: "Acompanhe e baixe os vídeos que estão sendo renderizados." },
  ] }),
  component: Fila,
});

const ICON = { "na fila": Clock, renderizando: Loader2, concluido: CheckCircle2, erro: AlertTriangle };
const COR = { "na fila": "text-muted-foreground", renderizando: "text-primary animate-spin", concluido: "text-success", erro: "text-destructive" };

function Fila() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [agora, setAgora] = useState(Date.now());
  useEffect(() => { const up = () => listJobs().then(setJobs); up(); const t = setInterval(() => setAgora(Date.now()), 1000); const off = onQueue(up); return () => { clearInterval(t); off(); }; }, []);
  const dur = (j: Job) => { const s = Math.round(((j.fim ?? agora) - (j.inicio ?? agora)) / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
  return (
    <AppShell title="Fila de renderização">
      <p className="mb-4 max-w-3xl text-sm text-muted-foreground">Os vídeos são renderizados um por vez no seu servidor (FFmpeg ou HyperFrames) enquanto o MotionMRO estiver aberto. Adicione vídeos pelo botão <b>Adicionar à fila</b> dentro de cada projeto.</p>
      <div className="overflow-hidden rounded-xl border border-border bg-card/70">
        {jobs.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">A fila está vazia.</p>}
        {jobs.map((j, i) => {
          const I = ICON[j.status];
          return (
            <div key={j.id} className="animate-fade-up flex flex-wrap items-center gap-4 border-b border-border p-4 last:border-0" style={{ animationDelay: `${i * 40}ms` }}>
              <I className={`h-5 w-5 ${COR[j.status]}`} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{j.nome}</div>
                <div className="font-mono text-xs text-muted-foreground">{j.modulo === "motion" ? "Motion IA" : "Video Overlay"} · {j.engine === "ffmpeg" ? "FFmpeg" : "HyperFrames"} · {j.status}{j.inicio ? ` · ${dur(j)}` : ""}</div>
                {j.erro && <div className="mt-1 text-xs text-destructive">{j.erro}</div>}
                {j.status === "renderizando" && <div className="mt-2 h-1 overflow-hidden rounded-full bg-secondary"><div className="shimmer-border h-full w-full" /></div>}
              </div>
              {j.resultado && <button onClick={() => download(j.resultado!, `${j.nome.replace(/\W+/g, "_")}.mp4`)} className="inline-flex items-center gap-2 rounded-md bg-gradient-primary px-3 py-2 text-sm font-semibold text-primary-foreground"><Download className="h-4 w-4" />Baixar</button>}
              {j.status === "erro" && <button onClick={async () => { await saveJob({ ...j, status: "na fila", erro: undefined }); void processarFila(); }} className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"><RotateCcw className="h-4 w-4" />Tentar de novo</button>}
              {j.status !== "renderizando" && <button aria-label="Remover" onClick={() => removeJob(j.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>}
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}
