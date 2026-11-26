import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Sparkles, Layers, Plus, Film } from "lucide-react";
import { AppShell } from "@/components/motion/AppShell";
import { AGENTES, listProjects, type Project } from "@/lib/projects";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Dashboard — MotionMRO" },
    { name: "description", content: "Painel do estúdio MotionMRO: projetos, renderizações e agentes de IA." },
    { property: "og:title", content: "Dashboard — MotionMRO" },
    { property: "og:description", content: "Painel do estúdio MotionMRO: projetos, renderizações e agentes de IA." },
  ] }),
  component: Dashboard,
});

function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  useEffect(() => { listProjects().then(setProjects); }, []);
  const prontos = projects.filter((p) => p.status === "pronto");
  const andamento = projects.filter((p) => p.status !== "pronto");
  const bytes = new Blob([JSON.stringify(projects)]).size;
  return (
    <AppShell title="Dashboard">
      <section className="relative overflow-hidden rounded-xl border border-border bg-stage p-8 grid-lines">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-primary">Estúdio de produção com IA</p>
        <h2 className="mt-3 max-w-2xl text-4xl font-bold leading-tight tracking-tight md:text-5xl">Descreva a ideia. Os agentes dirigem, roteirizam e programam o vídeo.</h2>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/novo" className="inline-flex items-center gap-2 rounded-md bg-gradient-primary px-5 py-3 font-semibold text-primary-foreground shadow-glow"><Plus className="h-4 w-4" />Novo projeto</Link>
          <Link to="/novo" className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-5 py-3 font-medium hover:border-primary"><Sparkles className="h-4 w-4 text-primary" />Criar Motion IA</Link>
          <Link to="/overlay" className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-5 py-3 font-medium hover:border-accent"><Layers className="h-4 w-4 text-accent" />Video Overlay IA</Link>
        </div>
      </section>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[["Projetos", projects.length], ["Em andamento", andamento.length], ["Prontos", prontos.length], ["Espaço local", `${(bytes / 1024).toFixed(1)} KB`]].map(([k, v]) => (
          <div key={k} className="rounded-lg border border-border bg-card p-5"><div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">{k}</div><div className="mt-2 text-3xl font-bold">{v}</div></div>
        ))}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <section className="rounded-lg border border-border bg-card p-5 lg:col-span-2">
          <h3 className="font-semibold">Projetos recentes</h3>
          {projects.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">Nenhum projeto ainda. Comece pelo botão "Novo projeto".</p> : (
            <ul className="mt-4 divide-y divide-border">
              {projects.slice(0, 6).map((p) => (
                <li key={p.id}><Link to="/projetos/$id" params={{ id: p.id }} className="flex items-center justify-between py-3 hover:text-primary">
                  <span className="flex items-center gap-3"><Film className="h-4 w-4 text-muted-foreground" />{p.config.nome}</span>
                  <span className="font-mono text-xs text-muted-foreground">{p.cenas.length} cenas · {p.status}</span>
                </Link></li>
              ))}
            </ul>
          )}
        </section>
        <section className="rounded-lg border border-border bg-card p-5">
          <h3 className="font-semibold">Agentes</h3>
          <ul className="mt-4 space-y-3">
            {AGENTES.map((a) => (<li key={a.key} className="flex items-start gap-3"><span className="mt-1.5 h-2 w-2 rounded-full bg-success" /><div><div className="text-sm font-medium">{a.nome}</div><div className="text-xs text-muted-foreground">{a.desc}</div></div></li>))}
          </ul>
        </section>
      </div>
    </AppShell>
  );
}
