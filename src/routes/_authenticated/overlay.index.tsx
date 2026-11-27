import { createId } from "@/lib/uuid";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Trash2, Upload } from "lucide-react";
import { AppShell } from "@/components/motion/AppShell";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAccount } from "@/components/motion/AccountProvider";
import { creditCost,planFor } from "@/lib/plans";
import { deleteOverlay, listOverlays, saveOverlay, type OverlayProject } from "@/lib/overlays";

export const Route = createFileRoute("/_authenticated/overlay/")({
  head: () => ({ meta: [
    { title: "Video Overlay IA — MotionMRO" },
    { name: "description", content: "Envie um vídeo e a IA entende a fala e cria overlays animados sincronizados." },
    { property: "og:title", content: "Video Overlay IA — MotionMRO" },
    { property: "og:description", content: "Envie um vídeo e a IA entende a fala e cria overlays animados sincronizados." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: OverlayHome,
});

function meta(file: File) {
  return new Promise<{ w: number; h: number; d: number }>((res, rej) => {
    const v = document.createElement("video"); v.preload = "metadata"; const url = URL.createObjectURL(file); v.src = url;
    v.onloadedmetadata = () => { URL.revokeObjectURL(url); res({ w: v.videoWidth, h: v.videoHeight, d: v.duration }); }; v.onerror = () => { URL.revokeObjectURL(url); rej(new Error("Vídeo inválido")); };
  });
}

function OverlayHome() {
  const nav = useNavigate();
  const {info,sales}=useAccount();
  const [duration,setDuration]=useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [nome, setNome] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [sons, setSons] = useState(true);
  const [lista, setLista] = useState<OverlayProject[]>([]);
  const [upload, setUpload] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState("");
  useEffect(() => { listOverlays().then(setLista); }, []);
  async function criar() {
    if (!file || upload !== null) return;
    setUpload(0);
    setUploadError("");
    try {
    const m = await meta(file);
    const max=info?.admin?600:Math.max(info?.account.trial_seconds??0,sales?(planFor(info?.account.plan??"")?.maxSeconds??0):0);
    if(Math.ceil(m.d)>max){toast.error("Vídeo acima do limite do seu plano ou teste.");return;}
    const p: OverlayProject = { id: createId(), nome: nome || file.name, criadoEm: Date.now(), atualizadoEm: Date.now(), video: file,
      largura: m.w, altura: m.h, duracao: m.d, sons, observacoes: observacoes.trim(), overlays: [], status: "rascunho", log: [] };
    await saveOverlay(p, setUpload);
    await nav({ to: "/overlay/$id", params: { id: p.id }, search: { iniciar: true } });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível enviar o vídeo. Tente novamente.";
      setUploadError(message);
      toast.error(message);
    } finally { setUpload(null); }
  }
  return (
    <AppShell title="Video Overlay IA">
      <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1fr_320px]">
        <section className="rounded-xl border border-border bg-stage p-6 grid-lines">
          <p className="font-mono text-xs uppercase tracking-widest text-primary">Envie seu vídeo</p>
          <label className="mt-4 flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border bg-card/70 p-10 text-center hover:border-primary">
            <Upload className="h-6 w-6 text-primary" />
            <span className="text-sm">{file ? file.name : "Clique para escolher um vídeo (MP4, MOV, WEBM)"}</span>
            <input type="file" accept="video/*" disabled={upload !== null} className="hidden" onChange={(e) => {const selected=e.target.files?.[0]??null;setFile(selected);setDuration(0);setUploadError("");if(selected)void meta(selected).then((m)=>setDuration(Math.ceil(m.d))).catch(()=>toast.error("Vídeo inválido."));}} />
          </label>
          <input value={nome} disabled={upload !== null} onChange={(e) => setNome(e.target.value)} placeholder="Nome do projeto" className="mt-4 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          <label htmlFor="overlay-observacoes" className="mt-4 block text-sm font-medium">Observações <span className="font-normal text-muted-foreground">(opcional)</span></label>
          <textarea id="overlay-observacoes" value={observacoes} disabled={upload !== null} onChange={(e) => setObservacoes(e.target.value)} rows={4} placeholder="Ex.: usar verde e branco, títulos fortes e destacar as palavras mais importantes." className="mt-2 w-full min-w-0 resize-y rounded-md border border-input bg-background px-3 py-2 text-sm" />
          <label className="mt-4 flex items-center gap-2 text-sm"><input type="checkbox" disabled={upload !== null} checked={sons} onChange={(e) => setSons(e.target.checked)} className="h-4 w-4 accent-primary" />Criar efeitos sonoros</label>
          <p className="mt-2 text-xs text-muted-foreground">A IA ouve toda a fala, cria overlays animados nos momentos certos, aplica movimentos de câmera no vídeo e sons (se marcado). </p>
          {duration>0&&duration<=600&&<p className="mt-4 text-sm text-accent">{info?.admin?"Produção administrativa":(info?.account.trial_seconds??0)>=duration?`Consumo: ${duration}s de teste`:`Consumo: ${creditCost(duration)} créditos`}</p>}
          <Button disabled={!file || upload !== null} onClick={()=>void criar()} className="mt-6 rounded-md bg-gradient-primary px-6 py-3 font-semibold text-primary-foreground shadow-glow disabled:opacity-40">
            {upload !== null && <Loader2 className="h-4 w-4 animate-spin" />}
            {upload === null ? "Criar overlays" : upload < 100 ? `Enviando vídeo ${upload}%` : "Confirmando envio…"}
          </Button>
          {upload !== null && <div className="mt-4 space-y-2" role="status" aria-live="polite">
            <div className="flex flex-wrap justify-between gap-2 text-sm"><span>{upload < 100 ? "Enviando vídeo" : "Vídeo enviado · salvando projeto…"}</span><span className="font-mono text-primary">{upload}%</span></div>
            <progress aria-label="Envio do vídeo" value={upload} max={100} className="h-2 w-full overflow-hidden rounded-full [&::-webkit-progress-bar]:bg-secondary [&::-webkit-progress-value]:bg-primary [&::-moz-progress-bar]:bg-primary" />
          </div>}
          {uploadError && <p role="alert" className="mt-3 text-sm text-destructive">{uploadError}</p>}
        </section>
        <aside className="space-y-2 rounded-xl border border-border bg-card p-4">
          <h3 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Projetos de overlay</h3>
          {lista.length === 0 && <p className="text-sm text-muted-foreground">Nenhum ainda.</p>}
          {lista.map((o) => (
            <div key={o.id} className="flex items-center gap-2 rounded-md border border-border p-2 text-sm">
              <Link to="/overlay/$id" params={{ id: o.id }} className="min-w-0 flex-1 truncate hover:text-primary">{o.nome}<span className="block text-xs text-muted-foreground">{o.overlays.length} overlays · {o.status}</span></Link>
              <button aria-label="Excluir" onClick={async () => { await deleteOverlay(o.id); setLista(await listOverlays()); }} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </aside>
      </div>
    </AppShell>
  );
}
