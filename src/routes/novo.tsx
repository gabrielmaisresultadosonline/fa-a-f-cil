import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { AppShell } from "@/components/motion/AppShell";
import { Button } from "@/components/ui/button";
import { FORMATOS, getProject, saveProject, type Project, type ProjectConfig } from "@/lib/projects";
import { reuseConfig } from "@/lib/projectBrief";

export const Route = createFileRoute("/novo")({
  validateSearch: z.object({ origem: z.string().optional() }),
  head: () => ({ meta: [
    { title: "Novo projeto Motion IA — MotionMRO" },
    { name: "description", content: "Descreva sua ideia e deixe os agentes de IA criarem o vídeo." },
    { property: "og:title", content: "Novo projeto Motion IA — MotionMRO" },
    { property: "og:description", content: "Descreva sua ideia e deixe os agentes de IA criarem o vídeo." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Novo,
});

const field = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary";

function Novo() {
  const nav = useNavigate();
  const { origem } = Route.useSearch();
  const [c, setC] = useState<ProjectConfig>({ nome: "", ideia: "", duracao: 20, largura: 1920, altura: 1080, estilo: "", paleta: "", publico: "", objetivo: "", idioma: "Português", velocidade: "Média", intensidade: "Alta", sons: true });
  const up = (k: keyof ProjectConfig, v: string | number) => setC((x) => ({ ...x, [k]: v }));
  const [carregando, setCarregando] = useState(!!origem);
  useEffect(() => {
    if (!origem) return;
    let active = true;
    setCarregando(true);
    getProject(origem).then((p) => {
      if (!active) return;
      if (p) setC(reuseConfig(p));
      else toast.error("Projeto original não encontrado neste navegador.");
    }).catch(() => { if (active) toast.error("Não foi possível carregar o pedido."); })
      .finally(() => { if (active) setCarregando(false); });
    return () => { active = false; };
  }, [origem]);
  async function criar() {
    const p: Project = { id: crypto.randomUUID(), criadoEm: Date.now(), atualizadoEm: Date.now(), config: { ...c, nome: c.nome || c.ideia.slice(0, 40) }, pedidoOriginal: { ...c }, cenas: [], log: [], status: "rascunho",
      agentes: { diretor: "aguardando", roteirista: "aguardando", desenvolvedor: "aguardando", validador: "aguardando" } };
    await saveProject(p);
    nav({ to: "/projetos/$id", params: { id: p.id }, search: { iniciar: true } });
  }
  return (
    <AppShell title="Motion IA — novo projeto">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1fr_340px]">
        <section className="min-w-0 rounded-lg border border-border bg-stage p-4 sm:p-6 grid-lines">
          <label className="font-mono text-xs uppercase tracking-widest text-primary">O que você quer produzir?</label>
          <textarea value={c.ideia} onChange={(e) => up("ideia", e.target.value)} rows={9}
            placeholder="Ex.: Crie um vídeo publicitário de 30 segundos apresentando uma ferramenta de automação para Instagram. Moderno, cinematográfico, fundo escuro, partículas e textos impactantes."
            className="mt-3 w-full resize-none rounded-lg border border-input bg-card/80 p-4 text-base outline-none focus:border-primary" />
          <label className="mt-4 flex items-center gap-2 text-sm"><input type="checkbox" checked={!!c.sons} onChange={(e) => setC((x) => ({ ...x, sons: e.target.checked }))} className="h-4 w-4 accent-primary" />Criar efeitos sonoros (a IA escolhe os melhores momentos)</label>
          <p className="mt-2 text-xs text-muted-foreground">Só a ideia já basta: campos vazios são decididos pelo Diretor Criativo.</p>
          <Button disabled={carregando || c.ideia.trim().length < 10} onClick={criar}
            className="mt-6 inline-flex items-center gap-2 rounded-md bg-gradient-primary px-6 py-3 font-semibold text-primary-foreground shadow-glow disabled:opacity-40">
            <Sparkles className="h-4 w-4" />{carregando ? "Carregando pedido…" : "Iniciar produção"}
          </Button>
        </section>
        <aside className="min-w-0 space-y-4 rounded-lg border border-border bg-card p-5">
          <div><label className="text-xs text-muted-foreground">Nome do projeto</label><input className={field} value={c.nome} onChange={(e) => up("nome", e.target.value)} /></div>
          <div><label className="text-xs text-muted-foreground">Formato</label>
              <select className={field} value={`${c.largura}x${c.altura}`} onChange={(e) => { const [w, h] = e.target.value.split("x").map(Number); if (w && h) setC((x) => ({ ...x, largura: w, altura: h })); }}>
              {FORMATOS.map((f) => <option key={f.label} value={`${f.w}x${f.h}`}>{f.w}×{f.h} — {f.label}</option>)}
            </select></div>
          <div><label className="text-xs text-muted-foreground">Duração: {c.duracao}s</label><input type="range" min={6} max={90} value={c.duracao} onChange={(e) => up("duracao", Number(e.target.value))} className="w-full accent-primary" /></div>
          {([["estilo", "Estilo visual"], ["paleta", "Paleta de cores"], ["publico", "Público-alvo"], ["objetivo", "Objetivo"]] as const).map(([k, l]) => (
            <div key={k}><label className="text-xs text-muted-foreground">{l}</label><input className={field} placeholder="A IA decide" value={c[k]} onChange={(e) => up(k, e.target.value)} /></div>
          ))}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-1">
            {([["idioma", ["Português", "English", "Español"]], ["velocidade", ["Lenta", "Média", "Rápida"]], ["intensidade", ["Sutil", "Média", "Alta"]]] as const).map(([k, opts]) => (
              <div key={k}><label className="text-xs capitalize text-muted-foreground">{k}</label><select className={field} value={c[k]} onChange={(e) => up(k, e.target.value)}>{opts.map((o) => <option key={o}>{o}</option>)}</select></div>
            ))}
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
