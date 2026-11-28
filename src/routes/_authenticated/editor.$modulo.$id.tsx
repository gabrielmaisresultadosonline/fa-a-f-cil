import { getStudioSettings } from "@/lib/settings";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, AudioLines, ChevronDown, Film, Loader2, Mic2, MousePointer2, Pause, Play, Scissors, Split, Square, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/motion/AppShell";
import { RenderStatus } from "@/components/motion/RenderStatus";
import { Timeline } from "@/components/editor/Timeline";
import { VideoPreview } from "@/components/editor/VideoPreview";
import { MusicTrimmer } from "@/components/editor/MusicTrimmer";
import { peaksFromBuffer } from "@/lib/waveform";
import { Button } from "@/components/ui/button";
import { addClip, deleteClip, findClip, getOrCreateEditor, saveEditor, setClipWindow, splitClip, updateClip, updateTrack, vocalsRemovedFor, type EditorModule, type EditorProject } from "@/lib/editor";
import { EditorAudioEngine } from "@/lib/editorAudio";
import { audioDuration, separateVocals } from "@/lib/media";
import { getProject, type Project } from "@/lib/projects";
import { getOverlay, type OverlayProject } from "@/lib/overlays";
import { enfileirar } from "@/lib/queue";
import { servidorUrl } from "@/lib/serverRender";

export const Route = createFileRoute("/_authenticated/editor/$modulo/$id")({
  head: () => ({ meta: [
    { title: "Editor de vídeo por camadas — MotionMRO" },
    { name: "description", content: "Corte, mova e mixe vídeo, músicas, gravações e efeitos antes de renderizar o MP4." },
    { property: "og:title", content: "Editor de vídeo por camadas — MotionMRO" },
    { property: "og:description", content: "Corte, mova e mixe vídeo, músicas, gravações e efeitos antes de renderizar o MP4." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: VideoEditor,
});

const field = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary";

function AudioControls({ volume, grave, agudo, onChange }: { volume: number; grave: number; agudo: number; onChange: (patch: { volume?: number; grave?: number; agudo?: number }) => void }) {
  return <div className="space-y-4">
    <label className="block text-xs"><span className="flex justify-between text-muted-foreground"><span>Volume</span><b className="font-mono text-foreground">{Math.round(volume * 100)}%</b></span><input aria-label="Volume" type="range" min={0} max={2} step={0.01} value={volume} onChange={(e) => onChange({ volume: Number(e.target.value) })} className="mt-2 w-full accent-primary" /></label>
    <label className="block text-xs"><span className="flex justify-between text-muted-foreground"><span>Graves</span><b className="font-mono text-foreground">{grave > 0 ? "+" : ""}{grave.toFixed(1)} dB</b></span><input aria-label="Graves" type="range" min={-12} max={12} step={0.5} value={grave} onChange={(e) => onChange({ grave: Number(e.target.value) })} className="mt-2 w-full accent-primary" /></label>
    <label className="block text-xs"><span className="flex justify-between text-muted-foreground"><span>Agudos</span><b className="font-mono text-foreground">{agudo > 0 ? "+" : ""}{agudo.toFixed(1)} dB</b></span><input aria-label="Agudos" type="range" min={-12} max={12} step={0.5} value={agudo} onChange={(e) => onChange({ agudo: Number(e.target.value) })} className="mt-2 w-full accent-primary" /></label>
  </div>;
}

function VideoEditor() {
  const { modulo: rawModule, id } = Route.useParams();
  const modulo = (rawModule === "overlay" ? "overlay" : "motion") as EditorModule;
  const [editor, setEditor] = useState<EditorProject | null>(null);
  const [motion, setMotion] = useState<Project | null>(null);
  const [overlay, setOverlay] = useState<OverlayProject | null>(null);
  const [error, setError] = useState("");
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [run, setRun] = useState(0);
  const [tool, setTool] = useState<"select" | "cut">("select");
  const [selectedClip, setSelectedClip] = useState<string>();
  const [selectedTrack, setSelectedTrack] = useState<string>();
  const [px, setPx] = useState(18);
  const [busy, setBusy] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [peaks, setPeaks] = useState<Record<string, Float32Array>>({});
  const peaksLoading = useRef(new Set<string>());
  const keysRef = useRef<{ toggle: () => void; remove: () => void }>({ toggle: () => {}, remove: () => {} });
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [sending, setSending] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<EditorAudioEngine | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordStartedRef = useRef(0);
  const recordTimelineRef = useRef(0);
  const editorRef = useRef<EditorProject | null>(null);
  const timeRef = useRef(0);
  editorRef.current = editor; timeRef.current = time;
  const audioEngine = () => { if (!audioRef.current) audioRef.current = new EditorAudioEngine(); return audioRef.current; };

  useEffect(() => {
    let active = true;
    if (!["motion", "overlay"].includes(rawModule)) { setError("Tipo de projeto inválido"); return; }
    Promise.all([
      getOrCreateEditor(modulo, id),
      modulo === "motion" ? getProject(id) : getOverlay(id),
    ]).then(([project, source]) => {
      if (!active) return;
      setEditor(project); setSelectedTrack(project.tracks[0]?.id);
      if (modulo === "motion") setMotion(source as Project); else setOverlay(source as OverlayProject);
      setPx(Math.max(5, Math.min(20, 850 / project.duracao)));
    }).catch((e) => { if (active) setError(e instanceof Error ? e.message : "Não foi possível abrir o editor"); });
    return () => { active = false; };
  }, [id, modulo, rawModule]);

  useEffect(() => {
    if (!editor) return;
    const timer = setTimeout(() => { void saveEditor(editor); }, 250);
    audioRef.current?.update(editor);
    return () => clearTimeout(timer);
  }, [editor]);

  useEffect(() => {
    if (!playing || !editor) return;
    let raf = 0;
    const startedAt = performance.now(), initial = timeRef.current;
    const tick = () => {
      const current = modulo === "overlay" ? videoRef.current?.currentTime ?? timeRef.current : Math.min(editor.duracao, initial + (performance.now() - startedAt) / 1000);
      setTime(Math.min(editor.duracao, current));
      if (current >= editor.duracao - 0.025) {
        videoRef.current?.pause(); audioRef.current?.stop(); setPlaying(false); setTime(editor.duracao); return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, run, editor?.id, editor?.duracao, modulo]); // eslint-disable-line react-hooks/exhaustive-deps

  // Waveforms: decode each audio once (shared with playback) and keep its peaks.
  useEffect(() => {
    if (!editor) return;
    for (const clip of editor.tracks.flatMap((t) => t.tipo === "video" ? [] : t.clips)) {
      const key = `${clip.assetId}:${clip.stem ?? "original"}`;
      if (!clip.blob && !clip.mediaId) continue;
      if (peaks[key] || peaksLoading.current.has(key)) continue;
      peaksLoading.current.add(key);
      audioEngine().loadBuffer(clip).then((buffer) => setPeaks((p) => ({ ...p, [key]: peaksFromBuffer(buffer) })))
        .catch(() => { /* waveform is optional */ }).finally(() => peaksLoading.current.delete(key));
    }
  }, [editor, peaks]); // eslint-disable-line react-hooks/exhaustive-deps

  // Space plays/pauses; Delete or Backspace removes the selected clip (except while typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName))) return;
      if (e.code === "Space") { e.preventDefault(); keysRef.current.toggle(); }
      else if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); keysRef.current.remove(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => () => { audioRef.current?.stop(); recorderRef.current?.stream.getTracks().forEach((t) => t.stop()); }, []);
  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => setRecordSeconds((Date.now() - recordStartedRef.current) / 1000), 250);
    return () => clearInterval(timer);
  }, [recording]);

  function pause() { setPlaying(false); videoRef.current?.pause(); audioRef.current?.stop(); }
  async function togglePlay() {
    const project = editorRef.current; if (!project) return;
    if (playing) { pause(); return; }
    const start = timeRef.current >= project.duracao ? 0 : timeRef.current;
    try {
      if (start !== timeRef.current) { setTime(start); setRun((r) => r + 1); }
      await audioEngine().play(project, start);
      if (modulo === "overlay" && videoRef.current) { videoRef.current.currentTime = start; await videoRef.current.play(); }
      setTime(start); setPlaying(true);
    } catch (e) { pause(); toast.error(e instanceof Error ? e.message : "Não foi possível tocar a prévia"); }
  }
  function seek(next: number) {
    pause(); const value = Math.max(0, Math.min(editor?.duracao ?? 0, next));
    setTime(value); if (videoRef.current) videoRef.current.currentTime = value; setRun((r) => r + 1);
  }
  function changeFromTimeline(next: EditorProject) { if (playing) pause(); setEditor(next); }

  async function addFiles(files: FileList | null) {
    if (!files?.length || !editor) return;
    setBusy("files");
    try {
      let next = editor, lastId = "";
      for (const file of Array.from(files)) {
        const duration = await audioDuration(file);
        next = addClip(next, { nome: file.name, sourceDuration: duration, inicio: timeRef.current, blob: file, tipo: "audio", novaFaixa: true });
        lastId = next.tracks.at(-1)?.clips.at(-1)?.id ?? lastId;
      }
      setEditor(next); setSelectedClip(lastId); toast.success(files.length === 1 ? "Áudio adicionado em uma nova camada" : `${files.length} áudios adicionados`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível adicionar o áudio"); }
    finally { setBusy(""); }
  }

  async function toggleRecording() {
    if (recording) { recorderRef.current?.stop(); return; }
    if (!editor) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : undefined;
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks: Blob[] = [];
      recordStartedRef.current = Date.now(); recordTimelineRef.current = timeRef.current;
      recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      recorder.onstop = () => {
        void (async () => {
          const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
          stream.getTracks().forEach((t) => t.stop()); setRecording(false); recorderRef.current = null;
          try {
            const elapsed = (Date.now() - recordStartedRef.current) / 1000;
            const duration = await audioDuration(blob).catch(() => elapsed);
            setEditor((current) => {
              if (!current) return current;
              const next = addClip(current, { nome: `Gravação ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`, sourceDuration: Math.max(0.1, duration), inicio: recordTimelineRef.current, blob, tipo: "gravacao" });
              setSelectedClip(next.tracks.find((t) => t.tipo === "gravacao")?.clips.at(-1)?.id);
              return next;
            });
            toast.success("Gravação adicionada à camada Gravações");
          } catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível adicionar a gravação"); }
        })();
      };
      recorderRef.current = recorder; recorder.start(250); setRecordSeconds(0); setRecording(true);
      toast.success("Gravando pelo microfone");
    } catch { toast.error("Permita o acesso ao microfone para gravar"); }
  }


  async function changeStem(stem: "original" | "instrumental") {
    if (!editor) return;
    const selected = findClip(editor, selectedClip); if (!selected?.clip.mediaId) return;
    pause();
    if (stem === "instrumental" && selected.clip.stem !== "instrumental") {
      setBusy("uvr"); setProgress(0);
      let info;
      try { info = await separateVocals(selected.clip.mediaId, setProgress, { inicio: selected.clip.offset, fim: selected.clip.offset + selected.clip.duracao }); }
      catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível remover a voz"); setBusy(""); return; }
      setBusy("");
      audioRef.current?.reset();
      const current = editorRef.current ?? editor;
      setEditor(updateClip(current, selected.clip.id, { stem, ...(info.faixaSemVoz ? { faixaSemVoz: info.faixaSemVoz } : {}) }));
      return;
    }
    audioRef.current?.reset();
    setEditor(updateClip(editor, selected.clip.id, { stem }));
  }

  async function render() {
    if (!editor) return;
    pause(); setSending(true);
    try {
      await saveEditor(editor);
      await enfileirar({ modulo, alvoId: id, nome: editor.nome, engine: getStudioSettings().motor ?? "ffmpeg", editorId: editor.id });
      toast.success("Envio confirmado. O servidor renderiza todas as camadas mesmo com o navegador fechado.");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao enviar a renderização"); }
    finally { setSending(false); }
  }

  if (error) return <AppShell title="Editor de vídeo"><p className="text-destructive">{error}</p><Link to={modulo === "motion" ? "/projetos" : "/overlay"} className="mt-4 inline-block text-primary">Voltar</Link></AppShell>;
  if (!editor) return <AppShell title="Abrindo editor…"><div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="animate-spin" />Preparando vídeo e camadas de áudio…</div></AppShell>;
  const selected = findClip(editor, selectedClip);
  const track = selected?.track ?? editor.tracks.find((t) => t.id === selectedTrack) ?? editor.tracks[0];
  const canSplit = !!selected && time > selected.clip.inicio + 0.05 && time < selected.clip.inicio + selected.clip.duracao - 0.05;
  const backTo = modulo === "motion" ? "/projetos/$id" : "/overlay/$id";
  const removeSelected = () => { if (!selected) return; pause(); setEditor(deleteClip(editor, selected.clip.id)); setSelectedClip(undefined); };
  keysRef.current = { toggle: () => void togglePlay(), remove: removeSelected };
  const changeWindow = (offset: number, duracao: number) => {
    if (!selected) return;
    if (playing) pause();
    let next = setClipWindow(editor, selected.clip.id, offset, duracao);
    const clip = findClip(next, selected.clip.id)?.clip;
    if (clip?.stem === "instrumental" && !vocalsRemovedFor(clip)) {
      next = updateClip(next, clip.id, { stem: "original" }); audioRef.current?.reset();
      toast.info("O trecho mudou. Clique em Remover voz de novo para este trecho.");
    }
    setEditor(next);
  };

  return (
    <AppShell title={`Vídeo editor · ${editor.nome}`} actions={<>
      <Link to={backTo} params={{ id }} className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"><ArrowLeft className="h-4 w-4" />Voltar à prévia</Link>
      <Button onClick={render} disabled={sending || recording}>{sending ? <Loader2 className="animate-spin" /> : <Film />}{sending ? "Enviando…" : "Renderizar vídeo"}</Button>
    </>}>
      <RenderStatus alvoId={id} />
      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_310px]">
        <div className="min-w-0 space-y-4">
          <VideoPreview editor={editor} motion={motion} overlay={overlay} time={time} playing={playing} run={run} videoRef={videoRef} videoTrack={editor.tracks.find((t) => t.tipo === "video")} />
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={togglePlay}>{playing ? <Pause /> : <Play />}{playing ? "Pausar" : "Reproduzir tudo"}</Button>
            <span className="rounded-md bg-secondary px-3 py-2 font-mono text-xs tabular-nums">{time.toFixed(2)} / {editor.duracao.toFixed(2)}s</span>
            <span className="ml-auto text-xs text-muted-foreground">As alterações são salvas automaticamente</span>
          </div>

          <section className="grid gap-3 rounded-lg border border-border bg-card p-3 md:grid-cols-[1fr_1fr]">
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border px-3 py-3 text-sm hover:border-primary">
              {busy === "files" ? <Loader2 className="h-4 w-4 animate-spin" /> : <AudioLines className="h-4 w-4 text-primary" />}Adicionar áudio
              <input type="file" accept="audio/*" multiple className="hidden" disabled={busy === "files"} onChange={(e) => { void addFiles(e.target.files); e.target.value = ""; }} />
            </label>
            <button onClick={toggleRecording} className={`flex items-center justify-center gap-2 rounded-md border px-3 py-3 text-sm ${recording ? "border-destructive text-destructive" : "border-border hover:border-primary"}`}>
              {recording ? <Square className="h-4 w-4 fill-current" /> : <Mic2 className="h-4 w-4 text-primary" />}{recording ? `Parar gravação · ${recordSeconds.toFixed(1)}s` : "Gravar áudio agora"}
            </button>
          </section>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-md border border-border bg-card p-1">
              <button aria-label="Cursor de seleção" title="Selecionar e mover" onClick={() => setTool("select")} data-on={tool === "select"} className="flex items-center gap-2 rounded px-3 py-1.5 text-xs data-[on=true]:bg-primary data-[on=true]:text-primary-foreground"><MousePointer2 className="h-4 w-4" />Seleção</button>
              <button aria-label="Cursor de corte" title="Clique em um clipe para dividir" onClick={() => setTool("cut")} data-on={tool === "cut"} className="flex items-center gap-2 rounded px-3 py-1.5 text-xs data-[on=true]:bg-primary data-[on=true]:text-primary-foreground"><Scissors className="h-4 w-4" />Corte</button>
            </div>
            <Button variant="outline" size="sm" disabled={!canSplit} onClick={() => { if (selected) changeFromTimeline(splitClip(editor, selected.clip.id, time)); }}><Split />Dividir no cursor</Button>
            <Button variant="outline" size="sm" disabled={!selected} onClick={removeSelected} className="text-destructive"><Trash2 />Remover</Button>
            <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">Zoom<input aria-label="Zoom da linha do tempo" type="range" min={4} max={80} value={px} onChange={(e) => setPx(Number(e.target.value))} className="w-24 accent-primary" /></label>
          </div>
          <Timeline project={editor} time={time} px={px} tool={tool} selectedClip={selectedClip} selectedTrack={selectedTrack} onSelectClip={setSelectedClip} onSelectTrack={setSelectedTrack} onSeek={seek} onChange={changeFromTimeline} peaks={peaks} />
          <p className="text-xs text-muted-foreground">Com Seleção, arraste o clipe para mover e suas bordas para aparar. Com Corte, clique no ponto desejado para dividir. Para excluir, selecione e clique em Remover ou pressione Delete/Backspace. Espaço reproduz e pausa.</p>
        </div>

        <aside className="min-w-0 space-y-4 xl:sticky xl:top-24 xl:self-start">
          <details className="group rounded-lg border border-border bg-card p-4">
            <summary className="flex cursor-pointer list-none items-center justify-between font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Camadas do vídeo ({editor.tracks.length})<ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" /></summary>
            <div className="mt-3 space-y-1">{editor.tracks.map((item) => <button key={item.id} data-on={track?.id === item.id} onClick={() => { setSelectedTrack(item.id); setSelectedClip(undefined); }} className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs hover:bg-secondary data-[on=true]:bg-primary/10 data-[on=true]:text-primary"><AudioLines className="h-3.5 w-3.5 shrink-0" /><span className="min-w-0 flex-1 truncate">{item.nome}</span><span className="font-mono text-[10px] text-muted-foreground">{item.tipo === "video" ? "vídeo" : item.clips.length}</span></button>)}</div>
          </details>
          {track && <section className="rounded-lg border border-border bg-card p-4">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Camada selecionada</p>
            <h2 className="mt-1 break-words font-semibold text-primary">{selected?.clip.nome ?? track.nome}</h2>
            {selected?.clip.mediaId || selected?.clip.blob ? <div className="mt-4 border-t border-border pt-4"><p className="mb-2 text-xs font-medium">Recortar música</p><MusicTrimmer clip={selected.clip} peaks={peaks[`${selected.clip.assetId}:${selected.clip.stem ?? "original"}`]} maxLength={editor.duracao - selected.clip.inicio} engine={audioEngine} onBeforePlay={pause} onWindow={changeWindow} /></div> : null}
            <details className="group mt-4 border-t border-border pt-4"><summary className="flex cursor-pointer list-none items-center justify-between text-xs font-medium">Volume, graves e agudos<ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" /></summary><div className="mt-4"><AudioControls volume={selected?.clip.volume ?? track.volume} grave={selected?.clip.grave ?? track.grave} agudo={selected?.clip.agudo ?? track.agudo} onChange={(patch) => setEditor(selected ? updateClip(editor, selected.clip.id, patch) : updateTrack(editor, track.id, patch))} /></div>
            {selected && <div className="mt-4 border-t border-border pt-4"><p className="mb-3 text-xs text-muted-foreground">Ajustes da camada inteira: {track.nome}</p><AudioControls volume={track.volume} grave={track.grave} agudo={track.agudo} onChange={(patch) => setEditor(updateTrack(editor, track.id, patch))} /></div>}</details>
            {selected?.clip.mediaId && <div className="mt-5 space-y-2 border-t border-border pt-4">
              <p className="text-xs text-muted-foreground">Voz da música (UVR)</p>
              <div className="grid grid-cols-2 gap-2"><Button variant={selected.clip.stem !== "instrumental" ? "default" : "outline"} size="sm" onClick={() => void changeStem("original")}>Original</Button><Button variant={selected.clip.stem === "instrumental" ? "default" : "outline"} size="sm" disabled={busy === "uvr"} onClick={() => void changeStem("instrumental")}>{busy === "uvr" ? <Loader2 className="animate-spin" /> : <Scissors />}{busy === "uvr" ? `Removendo ${progress ?? 0}%` : "Remover voz"}</Button></div>
              {busy === "uvr" && <div className="space-y-1"><div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${progress ?? 0}%` }} /></div><p className="text-xs text-muted-foreground">Removendo a voz: {progress ?? 0}% concluído. A primeira vez pode levar alguns minutos para começar.</p></div>}
            </div>}
            {selected && <Button variant="outline" className="mt-5 w-full text-destructive" onClick={removeSelected}><Trash2 />Remover este clipe</Button>}
          </section>}
          <section className="rounded-lg border border-border bg-card p-4 text-xs text-muted-foreground">
            <h3 className="font-semibold text-foreground">Renderização final</h3>
            <p className="mt-2">O MP4 inclui o vídeo, os overlays, os cortes, o som original e todas as camadas ativas. Volume, graves e agudos são aplicados no servidor.</p>
          </section>
        </aside>
      </div>
    </AppShell>
  );
}
