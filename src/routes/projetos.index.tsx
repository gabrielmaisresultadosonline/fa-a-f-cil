import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { AppShell } from "@/components/motion/AppShell";
import { deleteProject, listProjects, type Project } from "@/lib/projects";
import { ProjectRequest } from "@/components/motion/ProjectRequest";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/projetos/")({
  head: () => ({ meta: [
    { title: "Meus projetos — MotionMRO" },
    { name: "description", content: "Todos os seus vídeos e motion graphics criados com IA." },
    { property: "og:title", content: "Meus projetos — MotionMRO" },
    { property: "og:description", content: "Todos os seus vídeos e motion graphics criados com IA." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Projetos,
});

function Projetos() {
  const [ps, setPs] = useState<Project[]>([]);
  const load = () => listProjects().then(setPs);
  useEffect(() => { load(); }, []);
  return (
    <AppShell title="Meus projetos">
      {ps.length === 0 ? <p className="text-muted-foreground">Nenhum projeto ainda. <Link to="/novo" className="text-primary underline">Criar o primeiro</Link></p> : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {ps.map((p) => (
            <div key={p.id} className="group min-w-0 rounded-lg border border-border bg-card p-5 hover:border-primary">
              <Link to="/projetos/$id" params={{ id: p.id }} className="block">
                <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">{p.config.largura}×{p.config.altura} · {p.config.duracao}s</div>
                <div className="mt-2 break-words text-lg font-semibold">{p.config.nome}</div>
                <p className="mt-1 line-clamp-2 break-words text-sm text-muted-foreground">{p.config.ideia}</p>
                <div className="mt-4 text-xs text-primary">{p.cenas.length} cenas · {p.status}</div>
              </Link>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <ProjectRequest project={p} />
                <Button variant="ghost" size="icon" aria-label={`Excluir ${p.config.nome}`} title="Excluir projeto" onClick={async () => { if (confirm("Excluir este projeto?")) { await deleteProject(p.id); load(); } }} className="text-muted-foreground hover:text-destructive"><Trash2 /></Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
