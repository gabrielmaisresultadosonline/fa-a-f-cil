import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Sparkles, Layers, Plus, Film, ListVideo, ArrowRight, Volume2, Video, Clapperboard } from "lucide-react";
import { StudioBalance } from "@/components/motion/StudioBalance";
import { AppShell } from "@/components/motion/AppShell";
import { AGENTES, listProjects, type Project } from "@/lib/projects";
import { listOverlays, type OverlayProject } from "@/lib/overlays";
import { listJobs, onQueue, type Job } from "@/lib/queue";


export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [
    { title: "Dashboard — MotionMRO" },
    { name: "description", content: "Estúdio de vídeo com IA: motion graphics, overlays, editor de áudio por camadas, fila de renderização e custos." },
    { property: "og:title", content: "Dashboard — MotionMRO" },
    { property: "og:description", content: "Estúdio de vídeo com IA: motion graphics, overlays, editor de áudio por camadas, fila de renderização e custos." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Dashboard,
});

const STATUS: Record<string, string> = { pronto: "bg-success/15 text-success", produzindo: "bg-primary/15 text-primary", erro: "bg-destructive/15 text-destructive", rascunho: "bg-secondary text-muted-foreground" };

function Dashboard() {
  const [motion, setMotion] = useState<Project[]>([]);
  const [ovs, setOvs] = useState<OverlayProject[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  
  useEffect(() => {
    listProjects().then(setMotion); listOverlays().then(setOvs);
    const up = () => listJobs().then(setJobs); up(); return onQueue(up);
  }, []);

  const ativos = jobs.filter((j) => j.status === "enviando" || j.status === "na fila" || j.status === "renderizando");
  const recentes = [
    ...motion.map((p) => ({ id: p.id, nome: p.config.nome, t: p.atualizadoEm, status: p.status, info: `${p.cenas.length} cenas · ${p.cenas.reduce((s, c) => s + c.duracao, 0)}s`, tipo: "motion" as const })),
    ...ovs.map((p) => ({ id: p.id, nome: p.nome, t: p.atualizadoEm, status: p.status, info: `${p.overlays.length} overlays · ${p.duracao.toFixed(0)}s`, tipo: "overlay" as const })),
  ].sort((a, b) => b.t - a.t).slice(0, 7);


  return (
    <AppShell title="Dashboard" actions={<Link to="/novo" className="inline-flex items-center gap-2 rounded-md bg-gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-glow"><Plus className="h-4 w-4" />Novo projeto</Link>}>
      <StudioBalance />
      <section className="border-b border-border pb-8"><p className="font-mono text-xs uppercase tracking-widest text-accent">Seu espaço de produção</p><h2 className="mt-4 text-3xl font-bold">O que vamos criar hoje?</h2><div className="mt-6 flex flex-wrap gap-3"><Link to="/novo" className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 font-semibold text-primary-foreground"><Sparkles className="h-4 w-4"/>Criar Motion IA<ArrowRight className="h-4 w-4"/></Link><Link to="/overlay" className="inline-flex items-center gap-2 rounded-md border border-border px-5 py-3"><Layers className="h-4 w-4 text-accent"/>Video Overlay IA</Link></div></section>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[
          { i: Film, k: "Projetos Motion", v: motion.length, s: `${motion.filter((p) => p.status === "pronto").length} prontos`, to: "/projetos" as const },
          { i: Video, k: "Projetos Overlay", v: ovs.length, s: `${ovs.filter((p) => p.status === "pronto").length} prontos`, to: "/overlay" as const },
          { i: ListVideo, k: "Fila de renderização", v: ativos.length, s: `${jobs.filter((j) => j.status === "concluido").length} vídeos prontos`, to: "/fila" as const },

        ].map((c, i) => (
          <Link key={c.k} to={c.to} className="group animate-fade-up relative overflow-hidden rounded-xl border border-border bg-card/70 p-5 transition-all hover:-translate-y-0.5 hover:border-primary/50" style={{ animationDelay: `${i * 70}ms` }}>

            <c.i className="h-5 w-5 text-primary" />
            <div className="mt-4 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">{c.k}</div>
            <div className="mt-1 text-3xl font-bold tracking-tight">{c.v}</div>
            <div className="text-xs text-muted-foreground">{c.s}</div>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <section className="rounded-xl border border-border bg-card/70 p-5 xl:col-span-2">
          <div className="flex items-center justify-between"><h3 className="font-semibold">Projetos recentes</h3><Link to="/projetos" className="text-xs text-muted-foreground hover:text-primary">Ver todos</Link></div>
          {recentes.length === 0 ? <p className="mt-6 text-sm text-muted-foreground">Nenhum projeto ainda. Comece criando um Motion IA ou enviando um vídeo no Overlay.</p> : (
            <ul className="mt-3 divide-y divide-border">
              {recentes.map((p) => (
                <li key={p.id}>
                  <Link to={p.tipo === "motion" ? "/projetos/$id" : "/overlay/$id"} params={{ id: p.id }} className="group flex items-center gap-4 py-3">
                    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${p.tipo === "motion" ? "bg-primary/10 text-primary" : "bg-accent/10 text-accent"}`}>{p.tipo === "motion" ? <Sparkles className="h-4 w-4" /> : <Layers className="h-4 w-4" />}</span>
                    <span className="min-w-0 flex-1"><span className="block truncate font-medium group-hover:text-primary">{p.nome}</span><span className="font-mono text-xs text-muted-foreground">{p.info}</span></span>
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${STATUS[p.status] ?? STATUS['rascunho']}`}>{p.status}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <div className="space-y-6">
          <section className="rounded-xl border border-border bg-card/70 p-5">
            <div className="flex items-center justify-between"><h3 className="font-semibold">Renderizando</h3><Link to="/fila" className="text-xs text-muted-foreground hover:text-primary">Abrir fila</Link></div>
            {ativos.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">Nenhum vídeo na fila.</p> : ativos.slice(0, 4).map((j) => (
              <div key={j.id} className="mt-3"><div className="flex justify-between text-sm"><span className="truncate">{j.nome}</span><span className="font-mono text-xs text-muted-foreground">{j.status}</span></div>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-secondary">{j.status === "renderizando" && <div className="shimmer-border h-full w-full" />}</div></div>
            ))}
          </section>
          <section className="rounded-xl border border-border bg-card/70 p-5">
            <h3 className="font-semibold">Equipe de agentes</h3>
            <ul className="mt-3 space-y-3">
              {AGENTES.map((a) => (<li key={a.key} className="flex items-start gap-3">
                <span className="mt-0.5 grid h-7 w-7 place-items-center rounded-md bg-secondary">{a.key === "validador" ? <Volume2 className="h-3.5 w-3.5 text-primary" /> : <Sparkles className="h-3.5 w-3.5 text-primary" />}</span>
                <div><div className="text-sm font-medium">{a.nome}</div><div className="text-xs text-muted-foreground">{a.desc}</div></div></li>))}
            </ul>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
