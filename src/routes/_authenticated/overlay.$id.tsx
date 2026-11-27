import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Circle, Loader2, RefreshCw, Wand2, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { AppShell } from "@/components/motion/AppShell";
import { RenderStatus } from "@/components/motion/RenderStatus";
import { Button } from "@/components/ui/button";
import { SfxToggle } from "@/components/motion/SfxToggle";
import { getOverlay, saveOverlay, type OverlayProject } from "@/lib/overlays";
import { generateOverlay, runOverlayPipeline } from "@/lib/overlayPipeline";
import { scheduleSons } from "@/lib/sfx";
import { enfileirar } from "@/lib/queue";
import { prepareSceneHtml } from "@/lib/sceneLayout";

export const Route = createFileRoute("/_authenticated/overlay/$id")({
  validateSearch: z.object({ iniciar: z.boolean().optional() }),
  head: () => ({ meta: [
    { title: "Editor de overlay — MotionMRO" },
    { name: "description", content: "Assista ao vídeo com overlays, câmera e sons gerados pela IA e exporte." },
    { property: "og:title", content: "Editor de overlay — MotionMRO" },
    { property: "og:description", content: "Assista ao vídeo com overlays, câmera e sons gerados pela IA e exporte." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: OverlayEditor,
});

function camera(kind: string | undefined, dur: number): CSSProperties {
  const t = (s: number) => `transform ${s}s cubic-bezier(.22,1,.36,1)`;
  switch (kind) {
    case "punch": return { transform: "scale(1.14)", transition: t(0.25) };
    case "zoom-in": return { transform: "scale(1.1)", transition: t(dur) };
    case "zoom-out": return { transform: "scale(1)", transition: t(dur) };
    case "pan-esquerda": return { transform: "scale(1.12) translateX(4%)", transition: t(dur) };
    case "pan-direita": return { transform: "scale(1.12) translateX(-4%)", transition: t(dur) };
    default: return { transform: "scale(1)", transition: t(0.8) };
  }
}

function OverlayEditor() {
  const { id } = Route.useParams();
  const { iniciar } = Route.useSearch();
  const [p, setP] = useState<OverlayProject | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState(-1);
  const [sel, setSel] = useState(0);
  const [ajuste, setAjuste] = useState("");
  const [srv, setSrv] = useState(false);
  const [scale, setScale] = useState(0.4);
  const started = useRef(false);
  const video = useRef<HTMLVideoElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const url = useMemo(() => (p ? URL.createObjectURL(p.video) : ""), [p?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function start(proj: OverlayProject) { setBusy(true); await runOverlayPipeline(proj, setP); setBusy(false); }
  useEffect(() => {
    getOverlay(id).then((proj) => {
      setP(proj);
      if (proj && iniciar && !started.current && proj.status === "rascunho") { started.current = true; void start(proj); }
    });
  }, [id, iniciar]);

  useEffect(() => {
    const el = box.current; if (!el || !p) return;
    const ro = new ResizeObserver(() => setScale(Math.min(el.clientWidth / p.largura, el.clientHeight / p.altura)));
    ro.observe(el); return () => ro.disconnect();
  }, [p?.largura, p?.altura, p]);

  // acompanha o tempo do vídeo para ativar overlays
  useEffect(() => {
    if (!p) return; let raf = 0;
    const tick = () => {
      const t = video.current?.currentTime ?? 0;
      const idx = p.overlays.findIndex((o) => t >= o.inicio && t < o.fim && o.html);
      setActive((a) => (a === idx ? a : idx));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf);
  }, [p]);

  const cur = p && active >= 0 ? p.overlays[active] : undefined;
  useEffect(() => {
    if (!cur || !p || video.current?.paused) return;
    return scheduleSons(cur.sons, p.sons, (video.current?.currentTime ?? cur.inicio) - cur.inicio);
  }, [cur, p]);

  if (p === undefined) return <AppShell title="Carregando…"><div /></AppShell>;
  if (p === null) return <AppShell title="Projeto não encontrado"><Link to="/overlay" className="text-primary">Voltar</Link></AppShell>;
  const o = p.overlays[sel];

  async function renderizar() {
    if (!p) return;
    setSrv(true);
    try {
      await enfileirar({ modulo: "overlay", alvoId: p.id, nome: p.nome, engine: "ffmpeg" });
      toast.success("Envio confirmado. Pode fechar o navegador; o servidor continua renderizando.");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao enviar"); }
    finally { setSrv(false); }
  }
  async function regen() {
    if (!p) return; setBusy(true);
    try { await generateOverlay(p, sel, ajuste || undefined); setP({ ...p }); setAjuste(""); toast.success("Overlay atualizado"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
    setBusy(false);
  }

  return (
    <AppShell title={p.nome} actions={<>
      <Link to="/editor/$modulo/$id" params={{ modulo: "overlay", id: p.id }} disabled={!p.overlays.some((x) => x.html)} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40"><SlidersHorizontal className="h-4 w-4" />Abrir vídeo editor</Link>
      {(p.status === "erro" || (p.status === "rascunho" && !busy)) && <button onClick={() => start(p)} className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"><RefreshCw className="h-4 w-4" />{p.status === "erro" ? "Continuar" : "Iniciar"}</button>}
      <Button onClick={renderizar} disabled={busy || srv || !p.overlays.some((x) => x.html)}>
        {srv ? <Loader2 className="animate-spin" /> : <Circle className="fill-current" />}{srv ? "Enviando…" : "Renderizar agora"}</Button>
      <Button variant="outline" disabled={busy || srv || !p.overlays.some((x) => x.html)} onClick={renderizar}>Adicionar à fila</Button>
    </>}>
      <RenderStatus alvoId={id} />
      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <section className="flex min-w-0 flex-col gap-3">
          <div ref={box} className="grid h-[60vh] min-h-[320px] place-items-center overflow-hidden rounded-lg bg-stage grid-lines">
            <div ref={stage} style={{ width: p.largura * scale, height: p.altura * scale }} className="relative overflow-hidden bg-background">
              <video ref={video} src={url} controls playsInline className="absolute inset-0 h-full w-full object-cover"
                style={camera(cur?.camera, cur ? cur.fim - cur.inicio : 0)} />
              {cur?.html && (
                <iframe key={cur.id} title="overlay" srcDoc={prepareSceneHtml(cur.html, p.largura, p.altura)} sandbox="allow-scripts" className="pointer-events-none absolute left-0 top-0"
                  style={{ width: p.largura, height: p.altura, transform: `scale(${scale})`, transformOrigin: "0 0", border: 0, background: "transparent", colorScheme: "normal" }} />
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SfxToggle on={p.sons} onChange={async (v) => { p.sons = v; await saveOverlay(p); setP({ ...p }); }} />
            <span className="ml-auto font-mono text-xs text-muted-foreground">{p.overlays.filter((x) => x.html).length}/{p.overlays.length} overlays · {p.duracao.toFixed(1)}s</span>
          </div>
          <div className="flex gap-2 overflow-x-auto rounded-lg border border-border bg-card p-3">
            {p.overlays.length === 0 && <span className="text-sm text-muted-foreground">{busy ? "A IA está ouvindo o vídeo…" : "Sem overlays ainda."}</span>}
            {p.overlays.map((x, i) => (
              <button key={x.id} data-sel={i === sel} onClick={() => { setSel(i); if (video.current) video.current.currentTime = x.inicio; }}
                className="min-w-[130px] rounded-md border border-border bg-secondary p-2 text-left text-xs data-[sel=true]:border-primary">
                <div className="font-mono text-muted-foreground">{x.inicio.toFixed(1)}–{x.fim.toFixed(1)}s {!x.html && busy && <Loader2 className="inline h-3 w-3 animate-spin" />}</div>
                <div className="mt-1 truncate font-medium">{x.texto}</div>
              </button>
            ))}
          </div>
        </section>
        <aside className="space-y-4">
          <div className="max-h-48 overflow-auto rounded-lg border border-border bg-card p-3 font-mono text-xs">
            {p.log.slice().reverse().map((l, i) => <div key={i} className="mb-1 text-muted-foreground">{l.msg}</div>)}
          </div>
          {o && (
            <div className="space-y-2 rounded-lg border border-border bg-card p-4 text-sm">
              <h3 className="font-semibold text-primary">{o.texto}</h3>
              <p className="text-xs text-muted-foreground">{o.tipo} · {o.modo ?? "texto"} · {o.posicao} · câmera: {o.camera}{o.sons?.length ? ` · sons: ${o.sons.map((s) => s.tipo).join(", ")}` : ""}</p>
              <textarea value={ajuste} onChange={(e) => setAjuste(e.target.value)} rows={3} placeholder="Peça um ajuste neste overlay" className="w-full rounded-md border border-input bg-background p-2 text-sm" />
              <button onClick={regen} disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-gradient-primary px-3 py-2 font-semibold text-primary-foreground disabled:opacity-40">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}{ajuste ? "Aplicar ajuste" : "Regenerar overlay"}</button>
            </div>
          )}
          {p.transcricao && (
            <details className="rounded-lg border border-border bg-card p-4 text-sm">
              <summary className="cursor-pointer font-semibold">Transcrição</summary>
              <div className="mt-2 space-y-1 text-xs text-muted-foreground">{p.transcricao.map((s, i) => <p key={i}><span className="font-mono text-primary">{s.inicio.toFixed(1)}s</span> {s.texto}</p>)}</div>
            </details>
          )}
        </aside>
      </div>
    </AppShell>
  );
}
