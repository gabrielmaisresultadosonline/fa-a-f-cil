import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Waveform } from "./Waveform";
import type { EditorClip } from "@/lib/editor";
import type { EditorAudioEngine } from "@/lib/editorAudio";

const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`;

/** Full-song view: listen anywhere, then mark where the part used in the video starts and ends. */
export function MusicTrimmer({ clip, peaks, maxLength, engine, onWindow, onBeforePlay }: {
  clip: EditorClip; peaks?: Float32Array | undefined; maxLength: number; engine: () => EditorAudioEngine;
  onWindow: (offset: number, duracao: number) => void; onBeforePlay: () => void;
}) {
  const total = clip.sourceDuration;
  const [pos, setPos] = useState(clip.offset);
  const [playing, setPlaying] = useState(false);
  const started = useRef<{ at: number; from: number } | null>(null);
  const drag = useRef<{ x: number; offset: number; width: number; moved: boolean } | null>(null);

  useEffect(() => () => engine().stopSource(), [engine]);
  useEffect(() => { engine().stopSource(); setPlaying(false); setPos(clip.offset); }, [clip.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => { const s = started.current; if (s) setPos(Math.min(total, s.from + engine().now() - s.at)); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, total, engine]);

  async function toggle() {
    if (playing) { engine().stopSource(); setPlaying(false); return; }
    onBeforePlay();
    const from = pos >= total - 0.05 ? 0 : pos;
    const at = await engine().playSource(clip, from, () => setPlaying(false));
    started.current = { at, from }; setPlaying(true);
  }
  function seekTo(next: number) {
    const value = Math.max(0, Math.min(total, next)); setPos(value);
    if (playing) { engine().stopSource(); setPlaying(false); }
  }
  const end = clip.offset + clip.duracao;
  const pct = (s: number) => `${(s / total) * 100}%`;

  function down(e: ReactPointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    drag.current = { x: e.clientX, offset: clip.offset, width: rect.width, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function move(e: ReactPointerEvent<HTMLDivElement>) {
    const d = drag.current; if (!d) return;
    if (Math.abs(e.clientX - d.x) > 3) d.moved = true;
    if (d.moved) onWindow(Math.max(0, Math.min(total - clip.duracao, d.offset + ((e.clientX - d.x) / d.width) * total)), clip.duracao);
  }
  function up(e: ReactPointerEvent<HTMLDivElement>) {
    const d = drag.current; drag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (d && !d.moved) { const rect = e.currentTarget.getBoundingClientRect(); seekTo(((e.clientX - rect.left) / rect.width) * total); }
  }

  return <div className="space-y-2">
    <p className="text-xs text-muted-foreground">Ouça a música inteira, pause no ponto certo e marque o trecho que entra no vídeo. Arraste a área clara para escolher outra parte.</p>
    <div role="slider" aria-label="Posição na música" aria-valuemin={0} aria-valuemax={total} aria-valuenow={pos} tabIndex={0}
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
      className="relative h-16 cursor-pointer touch-none overflow-hidden rounded-md border border-border bg-background">
      <Waveform peaks={peaks} total={total} from={0} to={total} className="text-muted-foreground/50" />
      <div className="pointer-events-none absolute inset-y-0 border-x-2 border-primary bg-primary/15" style={{ left: pct(clip.offset), width: pct(clip.duracao) }} />
      <div className="pointer-events-none absolute inset-y-0 w-px bg-foreground" style={{ left: pct(pos) }} />
      {!peaks && <span className="pointer-events-none absolute inset-0 grid place-items-center text-[10px] text-muted-foreground">Carregando gráfico do áudio…</span>}
    </div>
    <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground"><span>{fmt(pos)}</span><span>trecho {fmt(clip.offset)} – {fmt(end)}</span><span>{fmt(total)}</span></div>
    <div className="grid grid-cols-[auto_1fr_1fr] gap-2">
      <Button size="sm" variant="outline" aria-label={playing ? "Pausar música" : "Ouvir música"} onClick={() => void toggle()}>{playing ? <Pause /> : <Play />}</Button>
      <Button size="sm" variant="outline" onClick={() => onWindow(Math.min(pos, total - 0.1), pos < end - 0.1 ? end - pos : maxLength)}><SkipBack />Início aqui</Button>
      <Button size="sm" variant="outline" disabled={pos <= clip.offset + 0.1} onClick={() => onWindow(clip.offset, pos - clip.offset)}><SkipForward />Fim aqui</Button>
    </div>
  </div>;
}
