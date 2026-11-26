import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Play, Pause, Download, Film, ListPlus, RefreshCw, Loader2, Check, X, Circle, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { AppShell } from "@/components/motion/AppShell";
import { RenderStatus } from "@/components/motion/RenderStatus";
import { ProjectRequest } from "@/components/motion/ProjectRequest";
import { Button } from "@/components/ui/button";
import { ScenePlayer } from "@/components/motion/ScenePlayer";
import { SfxToggle } from "@/components/motion/SfxToggle";
import { AGENTES, buildFullHtml, getProject, saveProject, type Project, type AgentStatus } from "@/lib/projects";
import { generateScene, runPipeline } from "@/lib/pipeline";
import { enfileirar } from "@/lib/queue";
import type { Engine } from "@/lib/serverRender";

export const Route = createFileRoute("/projetos/$id")({
  validateSearch: z.object({ iniciar: z.boolean().optional() }),
  head: () => ({ meta: [
    { title: "Editor de projeto — MotionMRO" },
    { name: "description", content: "Acompanhe os agentes, assista às cenas e ajuste seu vídeo." },
    { property: "og:title", content: "Editor de projeto — MotionMRO" },
    { property: "og:description", content: "Acompanhe os agentes, assista às cenas e ajuste seu vídeo." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Editor,
});

const ICON: Record<AgentStatus, React.ReactNode> = {
  aguardando: <Circle className="h-4 w-4 text-muted-foreground" />,
  executando: <Loader2 className="h-4 w-4 animate-spin text-primary" />,
  concluido: <Check className="h-4 w-4 text-success" />,
  erro: <X className="h-4 w-4 text-destructive" />,
};

function Editor() {
  const { id } = Route.useParams();
  const { iniciar } = Route.useSearch();
  const [p, setP] = useState<Project | null | undefined>(undefined);
  const [sel, setSel] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [single, setSingle] = useState(false);
  const [ajuste, setAjuste] = useState("");
  const [busy, setBusy] = useState(false);
  const started = useRef(false);
  const [engine, setEngine] = useState<Engine>("ffmpeg");
  const [enviando, setEnviando] = useState(false);

  const start = useCallback(async (proj: Project) => {
    setBusy(true);
    await runPipeline(proj, setP);
    setBusy(false);
  }, []);

  useEffect(() => {
    getProject(id).then((proj) => {
      setP(proj);
      if (proj && iniciar && !started.current && proj.status === "rascunho") { started.current = true; start(proj); }
    });
  }, [id, iniciar, start]);

  if (p === undefined) return <AppShell title="Carregando…"><div /></AppShell>;
  if (p === null) return <AppShell title="Projeto não encontrado"><Link to="/projetos" className="text-primary">Voltar</Link></AppShell>;

  const ready = p.cenas.filter((c) => c.html);
  const cena = p.cenas[sel];

  async function regen() {
    if (!p) return;
    setBusy(true);
    try { await generateScene(p, sel, ajuste || undefined); setP({ ...p }); setAjuste(""); toast.success("Cena atualizada"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
    setBusy(false);
  }
  function exportar() {
    if (!p) return;
    const blob = new Blob([buildFullHtml(p)], { type: "text/html" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${p.config.nome.replace(/\W+/g, "_")}.html`; a.click();
  }
  async function rename(nome: string) { if (!p) return; p.config.nome = nome; await saveProject(p); setP({ ...p }); }
  async function renderizar() {
    if (!p) return;
    setEnviando(true);
    try { await enfileirar({ modulo: "motion", alvoId: p.id, nome: p.config.nome, engine }); toast.success("Envio confirmado. Pode fechar o navegador; o servidor continua renderizando."); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao enviar"); }
    finally { setEnviando(false); }
  }

  return (
    <AppShell title={p.config.nome} actions={<>
      <ProjectRequest project={p} />
      {(p.status === "erro" || (p.status === "rascunho" && !busy)) && <button onClick={() => start(p)} disabled={busy} className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:border-primary"><RefreshCw className="h-4 w-4" />{p.status === "erro" ? "Continuar produção" : "Iniciar produção"}</button>}
      <button onClick={exportar} disabled={!ready.length} className="inline-flex items-center gap-2 rounded-md bg-gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40"><Download className="h-4 w-4" />Exportar HTML</button>
      <Link to="/renderizar/$id" params={{ id: p.id }} disabled={!ready.length} className="inline-flex items-center gap-2 rounded-md border border-primary px-4 py-2 text-sm font-semibold text-primary"><Film className="h-4 w-4" />Gravar no navegador</Link>
      <select value={engine} onChange={(e) => setEngine(e.target.value as Engine)} className="rounded-md border border-input bg-background px-2 py-2 text-sm"><option value="ffmpeg">FFmpeg</option><option value="hyperframes">HyperFrames</option></select>
      <Button disabled={!ready.length || busy || enviando} onClick={renderizar}>{enviando ? <Loader2 className="animate-spin" /> : <Film />}{enviando ? "Enviando…" : "Renderizar vídeo"}</Button>
      <Button variant="outline" disabled={!ready.length || busy || enviando} onClick={renderizar}><ListPlus />Adicionar à fila</Button>
    </>}>
      <RenderStatus alvoId={id} />
      <div className="grid gap-6 xl:grid-cols-[260px_1fr_300px]">
        <aside className="min-w-0 space-y-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Agentes</h3>
            <ul className="mt-3 space-y-3">{AGENTES.filter((a) => a.key !== "locutor" || p.config.voz).map((a) => (<li key={a.key} className="flex items-start gap-3">{ICON[p.agentes[a.key] ?? "aguardando"]}<div><div className="text-sm font-medium">{a.nome}</div><div className="text-xs text-muted-foreground">{a.desc}</div></div></li>))}</ul>
          </div>
          <div className="max-h-72 overflow-auto rounded-lg border border-border bg-card p-4 font-mono text-xs">
            {p.log.length === 0 ? <span className="text-muted-foreground">Sem eventos.</span> : p.log.slice().reverse().map((l, i) => (
              <div key={i} className="mb-2"><span className="text-primary">{l.agente}</span> <span className="text-muted-foreground">{l.msg}</span></div>
            ))}
          </div>
        </aside>

        <section className="flex min-w-0 flex-col gap-4">
          <div className="h-[56vh] min-h-[320px]">
            <ScenePlayer scenes={single ? (cena ? [cena] : []) : ready} width={p.config.largura} height={p.config.altura}
              start={single ? 0 : Math.max(0, ready.findIndex((c) => c.id === cena?.id))} playing={playing} loopSingle={single} sfx={!!p.config.sons} voz={!!p.config.voz} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setPlaying((x) => !x)} className="inline-flex items-center gap-2 rounded-md bg-secondary px-3 py-2 text-sm">{playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}{playing ? "Pausar" : "Reproduzir"}</button>
            <button onClick={() => setSingle((x) => !x)} className="rounded-md border border-border px-3 py-2 text-sm data-[on=true]:border-primary data-[on=true]:text-primary" data-on={single}>{single ? "Só esta cena" : "Vídeo completo"}</button>
            <SfxToggle on={!!p.config.sons} onChange={async (v) => { p.config.sons = v; await saveProject(p); setP({ ...p }); }} />
            <span className="ml-auto font-mono text-xs text-muted-foreground">{ready.length}/{p.cenas.length} cenas · {p.cenas.reduce((s, c) => s + c.duracao, 0)}s</span>
          </div>
          <div className="flex gap-2 overflow-x-auto rounded-lg border border-border bg-card p-3">
            {p.cenas.length === 0 && <span className="text-sm text-muted-foreground">{busy ? "Os agentes estão criando as cenas…" : "Sem cenas ainda."}</span>}
            {p.cenas.map((c, i) => (
              <button key={c.id} onClick={() => setSel(i)} style={{ flexGrow: c.duracao, minWidth: 110 }}
                className="rounded-md border border-border bg-secondary p-3 text-left text-xs data-[sel=true]:border-primary data-[sel=true]:shadow-glow" data-sel={i === sel}>
                <div className="font-mono text-muted-foreground">#{i + 1} · {c.duracao}s {!c.html && busy && <Loader2 className="inline h-3 w-3 animate-spin" />}</div>
                <div className="mt-1 truncate font-medium">{c.titulo}</div>
              </button>
            ))}
          </div>
        </section>

        <aside className="min-w-0 space-y-4 break-words">
          <div className="rounded-lg border border-border bg-card p-4">
            <label className="text-xs text-muted-foreground">Nome do projeto</label>
            <input defaultValue={p.config.nome} onBlur={(e) => rename(e.target.value)} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </div>
          {cena && (
            <div className="space-y-3 rounded-lg border border-border bg-card p-4 text-sm">
              <h3 className="font-semibold">Cena {sel + 1}: {cena.titulo}</h3>
              <p className="text-lg font-semibold text-primary">{cena.textoPrincipal}</p>
              {cena.textoSecundario && <p className="text-muted-foreground">{cena.textoSecundario}</p>}
              <p className="text-xs text-muted-foreground">{cena.descricaoVisual}</p>
              <p className="text-xs"><span className="text-muted-foreground">Animação:</span> {cena.animacao}</p>
              {cena.movimentoCamera && <p className="text-xs"><span className="text-muted-foreground">Câmera:</span> {cena.movimentoCamera}</p>}
              {cena.narracao && <p className="text-xs"><span className="text-muted-foreground">Narração:</span> “{cena.narracao}”</p>}
              {!!cena.sons?.length && <p className="text-xs"><span className="text-muted-foreground">Sons:</span> {cena.sons.map((s) => `${s.tipo} ${s.t}s`).join(" · ")}</p>}
              <textarea value={ajuste} onChange={(e) => setAjuste(e.target.value)} rows={3} placeholder="Peça um ajuste: ex. deixe o texto maior e a entrada mais rápida"
                className="w-full rounded-md border border-input bg-background p-2 text-sm" />
              <button onClick={regen} disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-gradient-primary px-3 py-2 font-semibold text-primary-foreground disabled:opacity-40">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}{ajuste ? "Aplicar ajuste" : "Regenerar cena"}
              </button>
            </div>
          )}
          {p.direcao && (
            <details className="rounded-lg border border-border bg-card p-4 text-sm">
              <summary className="cursor-pointer font-semibold">Direção criativa</summary>
              <pre className="mt-3 whitespace-pre-wrap font-sans text-xs text-muted-foreground">{p.direcao}</pre>
            </details>
          )}
        </aside>
      </div>
    </AppShell>
  );
}
