import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Circle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ScenePlayer } from "@/components/motion/ScenePlayer";
import { SfxToggle } from "@/components/motion/SfxToggle";
import { getProject, saveProject, type Project } from "@/lib/projects";
import { audioCtx, recordDest } from "@/lib/sfx";
import { download, recordRegion } from "@/lib/recorder";

export const Route = createFileRoute("/_authenticated/renderizar/$id")({
  head: () => ({ meta: [
    { title: "Renderizar vídeo — MotionMRO" },
    { name: "description", content: "Transforme seu motion graphics em um arquivo de vídeo com efeitos sonoros." },
    { property: "og:title", content: "Renderizar vídeo — MotionMRO" },
    { property: "og:description", content: "Transforme seu motion graphics em um arquivo de vídeo com efeitos sonoros." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Render,
});

function Render() {
  const { id } = Route.useParams();
  const [p, setP] = useState<Project | null>(null);
  const [run, setRun] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [rec, setRec] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  useEffect(() => { getProject(id).then(setP); }, [id]);
  if (!p) return <div className="grid h-screen place-items-center bg-background text-muted-foreground">Carregando…</div>;
  const scenes = p.cenas.filter((c) => c.html);
  const total = scenes.reduce((s, c) => s + c.duracao, 0);
  const sfx = !!p.config.sons;

  async function gravar() {
    if (!p || !stage.current) return;
    setPlaying(false); setRec(true);
    try {
      if (sfx) { audioCtx(); recordDest(); }
      const { blob, ext } = await recordRegion(stage.current, total, sfx ? recordDest().stream : null, () => { setRun((r) => r + 1); setPlaying(true); });
      download(blob, `${p.config.nome.replace(/\W+/g, "_")}.${ext}`);
      toast.success(`Vídeo ${ext.toUpperCase()} gerado`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Gravação cancelada"); }
    setRec(false); setPlaying(false);
  }
  async function toggleSfx(v: boolean) { if (!p) return; p.config.sons = v; await saveProject(p); setP({ ...p }); }

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      {!rec && (
        <header className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
          <Link to="/projetos/$id" params={{ id }} className="inline-flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" />Voltar</Link>
          <span className="font-semibold">{p.config.nome}</span>
          <span className="font-mono text-xs text-muted-foreground">{p.config.largura}×{p.config.altura} · {total}s · {scenes.length} cenas</span>
          <div className="ml-auto flex items-center gap-2">
            <SfxToggle on={sfx} onChange={toggleSfx} />
            <button onClick={() => { setRun((r) => r + 1); setPlaying(true); }} className="rounded-md border border-border px-3 py-2 text-sm">Pré-visualizar</button>
            <button onClick={gravar} disabled={!scenes.length} className="inline-flex items-center gap-2 rounded-md bg-gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40">
              <Circle className="h-3 w-3 fill-current" />Gerar vídeo
            </button>
          </div>
          <p className="w-full text-xs text-muted-foreground">Ao clicar em Gerar vídeo, escolha <b>Esta aba</b> na janela do navegador (Chrome ou Edge). O vídeo toca do início ao fim e o arquivo é baixado sozinho. Deixe a janela maximizada para mais qualidade.</p>
        </header>
      )}
      {rec && <div className="flex items-center gap-2 px-4 py-2 text-xs text-destructive"><Loader2 className="h-3 w-3 animate-spin" />Gravando… não mexa nesta aba ({total}s)</div>}
      <div className="min-h-0 flex-1 p-2">
        <ScenePlayer key={run} scenes={scenes} width={p.config.largura} height={p.config.altura} playing={playing} sfx={sfx} stageRef={stage} noLoop />
      </div>
    </div>
  );
}
