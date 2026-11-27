import { useRef, type PointerEvent as ReactPointerEvent } from "react";
import { Waveform } from "./Waveform";
import { Music2, Video, Volume2, VolumeX, Waves, Mic2, AudioLines } from "lucide-react";
import { moveClipTo, splitClip, trimClipTo, updateTrack, type EditorClip, type EditorProject, type EditorTrack } from "@/lib/editor";

interface DragState { id: string; mode: "move" | "inicio" | "fim"; x: number; clip: EditorClip }
const icons = { video: Video, efeitos: Waves, musica: Music2, gravacao: Mic2, audio: AudioLines };

export function Timeline({ project, time, px, tool, selectedClip, selectedTrack, onSelectClip, onSelectTrack, onSeek, onChange, peaks = {} }: {
  peaks?: Record<string, Float32Array>;
  project: EditorProject; time: number; px: number; tool: "select" | "cut";
  selectedClip: string | undefined; selectedTrack: string | undefined;
  onSelectClip: (id?: string) => void; onSelectTrack: (id: string) => void;
  onSeek: (time: number) => void; onChange: (project: EditorProject) => void;
}) {
  const drag = useRef<DragState | null>(null);
  const laneWidth = Math.max(420, project.duracao * px);
  const step = project.duracao <= 15 ? 1 : project.duracao <= 60 ? 5 : project.duracao <= 180 ? 15 : 60;
  const marks = Array.from({ length: Math.floor(project.duracao / step) + 1 }, (_, i) => i * step);

  function down(e: ReactPointerEvent<HTMLElement>, clip: EditorClip, mode: DragState["mode"]) {
    e.stopPropagation(); onSelectClip(clip.id);
    if (tool === "cut" && mode === "move") {
      const rect = e.currentTarget.getBoundingClientRect();
      onChange(splitClip(project, clip.id, clip.inicio + (e.clientX - rect.left) / px));
      return;
    }
    drag.current = { id: clip.id, mode, x: e.clientX, clip: { ...clip } };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function move(e: ReactPointerEvent<HTMLElement>) {
    const d = drag.current; if (!d) return;
    const delta = (e.clientX - d.x) / px;
    if (d.mode === "move") onChange(moveClipTo(project, d.id, d.clip.inicio + delta));
    else onChange(trimClipTo(project, d.id, d.mode, (d.mode === "inicio" ? d.clip.inicio : d.clip.inicio + d.clip.duracao) + delta));
  }
  function up(e: ReactPointerEvent<HTMLElement>) {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    drag.current = null;
  }
  function clipButton(track: EditorTrack, clip: EditorClip) {
    const active = selectedClip === clip.id;
    return (
      <button key={clip.id} type="button" aria-label={`${clip.nome}, ${clip.inicio.toFixed(1)} a ${(clip.inicio + clip.duracao).toFixed(1)} segundos`}
        onPointerDown={(e) => down(e, clip, "move")} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        onClick={(e) => e.stopPropagation()}
        data-selected={active} className={`group absolute inset-y-2 min-w-3 touch-none overflow-hidden rounded-md border bg-secondary text-left text-[11px] shadow-sm outline-none data-[selected=true]:border-primary data-[selected=true]:bg-primary/15 data-[selected=true]:ring-1 data-[selected=true]:ring-primary ${tool === "cut" ? "cursor-crosshair" : "cursor-grab active:cursor-grabbing"}`}
        style={{ left: clip.inicio * px, width: Math.max(12, clip.duracao * px) }}>
        {peaks[`${clip.assetId}:${clip.stem ?? "original"}`] ? <span className="pointer-events-none absolute inset-0 text-primary/60"><Waveform peaks={peaks[`${clip.assetId}:${clip.stem ?? "original"}`]} total={clip.sourceDuration} from={clip.offset} to={clip.offset + clip.duracao} /></span> : <span className="pointer-events-none absolute inset-0 opacity-40" style={{ backgroundImage: "repeating-linear-gradient(90deg, var(--primary) 0 2px, transparent 2px 8px)" }} />}
        <span className="relative block truncate px-4 font-medium text-foreground">{clip.nome}</span>
        <span className="relative block truncate px-4 font-mono text-[9px] text-muted-foreground">{clip.duracao.toFixed(1)}s · {Math.round(clip.volume * track.volume * 100)}%</span>
        <span role="button" tabIndex={0} aria-label={`Aparar início de ${clip.nome}`} onPointerDown={(e) => down(e, clip, "inicio")} onPointerMove={move} onPointerUp={up}
          className="absolute inset-y-0 left-0 z-10 w-3 cursor-ew-resize touch-none border-r border-primary/50 bg-primary/10 opacity-0 group-hover:opacity-100 group-focus:opacity-100" />
        <span role="button" tabIndex={0} aria-label={`Aparar fim de ${clip.nome}`} onPointerDown={(e) => down(e, clip, "fim")} onPointerMove={move} onPointerUp={up}
          className="absolute inset-y-0 right-0 z-10 w-3 cursor-ew-resize touch-none border-l border-primary/50 bg-primary/10 opacity-0 group-hover:opacity-100 group-focus:opacity-100" />
      </button>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card" aria-label="Linha do tempo do vídeo">
      <div className="min-w-max">
        <div className="flex h-9 border-b border-border">
          <div className="sticky left-0 z-20 flex w-36 shrink-0 items-center border-r border-border bg-card px-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground sm:w-44">Camadas</div>
          <div className="relative h-full cursor-crosshair bg-background/50" style={{ width: laneWidth }} onPointerDown={(e) => {
            const rect = e.currentTarget.getBoundingClientRect(); onSeek(Math.max(0, Math.min(project.duracao, (e.clientX - rect.left) / px)));
          }}>
            {marks.map((mark) => <span key={mark} className="pointer-events-none absolute top-0 h-full border-l border-border pl-1 pt-1 font-mono text-[9px] text-muted-foreground" style={{ left: mark * px }}>{mark}s</span>)}
            <span className="pointer-events-none absolute -bottom-1 top-0 z-30 w-px bg-primary" style={{ left: time * px }}><span className="absolute -left-1.5 top-0 h-2.5 w-3 rounded-sm bg-primary" /></span>
          </div>
        </div>
        {project.tracks.map((track) => {
          const Icon = icons[track.tipo];
          return (
            <div key={track.id} className="flex h-20 border-b border-border last:border-0" data-selected={selectedTrack === track.id}>
              <div className="sticky left-0 z-20 flex w-36 shrink-0 items-center gap-2 border-r border-border bg-card px-2 sm:w-44 sm:px-3 data-[selected=true]:bg-secondary" data-selected={selectedTrack === track.id}>
                <button className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => { onSelectTrack(track.id); onSelectClip(undefined); }}>
                  <Icon className="h-4 w-4 shrink-0 text-primary" /><span className="min-w-0"><span className="block truncate text-xs font-medium">{track.nome}</span><span className="block text-[10px] text-muted-foreground">{track.tipo === "video" ? "imagem + som original" : `${track.clips.length} clipe(s)`}</span></span>
                </button>
                <button type="button" aria-label={track.mudo ? `Ativar ${track.nome}` : `Silenciar ${track.nome}`} onClick={() => onChange(updateTrack(project, track.id, { mudo: !track.mudo }))} className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-primary">{track.mudo ? <VolumeX className="h-4 w-4 text-destructive" /> : <Volume2 className="h-4 w-4" />}</button>
              </div>
              <div className="relative bg-background/40" style={{ width: laneWidth }} onClick={() => { onSelectTrack(track.id); onSelectClip(undefined); }}>
                {track.tipo === "video" && <button onClick={() => onSelectTrack(track.id)} className="absolute inset-y-2 left-0 flex items-center overflow-hidden rounded-md border border-primary/40 bg-primary/10 px-3 text-xs font-medium text-primary" style={{ width: Math.max(12, project.duracao * px) }}><Video className="mr-2 h-4 w-4 shrink-0" /><span className="truncate">Vídeo criado · {project.duracao.toFixed(1)}s</span></button>}
                {track.clips.map((clip) => clipButton(track, clip))}
                {!track.clips.length && track.tipo !== "video" && <span className="pointer-events-none absolute left-3 top-7 text-xs text-muted-foreground">Arraste ou adicione um áudio</span>}
                <span className="pointer-events-none absolute inset-y-0 z-30 w-px bg-primary/80" style={{ left: time * px }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
