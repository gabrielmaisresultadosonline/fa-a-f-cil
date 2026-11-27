import { useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from "react";
import { ScenePlayer } from "@/components/motion/ScenePlayer";
import { prepareSceneHtml } from "@/lib/sceneLayout";
import type { EditorProject, EditorTrack } from "@/lib/editor";
import type { Project } from "@/lib/projects";
import type { OverlayProject } from "@/lib/overlays";

function camera(kind: string | undefined, dur: number): CSSProperties {
  const transition = `transform ${dur || 0.25}s cubic-bezier(.22,1,.36,1)`;
  if (kind === "punch") return { transform: "scale(1.14)", transition: "transform .25s cubic-bezier(.22,1,.36,1)" };
  if (kind === "zoom-in") return { transform: "scale(1.1)", transition };
  if (kind === "zoom-out") return { transform: "scale(1)", transition };
  if (kind === "pan-esquerda") return { transform: "scale(1.12) translateX(4%)", transition };
  if (kind === "pan-direita") return { transform: "scale(1.12) translateX(-4%)", transition };
  return { transform: "scale(1)", transition };
}

export function VideoPreview({ editor, motion, overlay, time, playing, run, videoRef, videoTrack }: {
  editor: EditorProject; motion: Project | null; overlay: OverlayProject | null;
  time: number; playing: boolean; run: number;
  videoRef: RefObject<HTMLVideoElement | null>; videoTrack: EditorTrack | undefined;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.4);
  const audio = useRef<{ context: AudioContext; gain: GainNode; grave: BiquadFilterNode; agudo: BiquadFilterNode } | null>(null);
  const url = useMemo(() => overlay ? URL.createObjectURL(overlay.video) : "", [overlay]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  useEffect(() => {
    const el = box.current; if (!el || editor.modulo !== "overlay") return;
    const resize = () => setScale(Math.min(el.clientWidth / editor.largura, el.clientHeight / editor.altura));
    const observer = new ResizeObserver(resize); observer.observe(el); resize();
    return () => observer.disconnect();
  }, [editor.largura, editor.altura, editor.modulo]);
  useEffect(() => {
    const video = videoRef.current; if (!video || !overlay) return;
    if (!audio.current) {
      const context = new AudioContext();
      const source = context.createMediaElementSource(video);
      const grave = context.createBiquadFilter(); grave.type = "lowshelf"; grave.frequency.value = 180;
      const agudo = context.createBiquadFilter(); agudo.type = "highshelf"; agudo.frequency.value = 3200;
      const gain = context.createGain(); source.connect(grave).connect(agudo).connect(gain).connect(context.destination);
      audio.current = { context, gain, grave, agudo };
    }
    if (playing) void audio.current.context.resume();
    audio.current.gain.gain.value = videoTrack?.mudo ? 0 : videoTrack?.volume ?? 1;
    audio.current.grave.gain.value = videoTrack?.grave ?? 0;
    audio.current.agudo.gain.value = videoTrack?.agudo ?? 0;
  }, [overlay, videoTrack, videoRef, playing]);

  if (editor.modulo === "motion" && motion) {
    const scenes = motion.cenas.filter((c) => c.html);
    let elapsed = 0, index = 0;
    for (let i = 0; i < scenes.length; i++) {
      const duration = scenes[i]?.duracao ?? 0;
      if (time < elapsed + duration || i === scenes.length - 1) { index = i; break; }
      elapsed += duration;
    }
    return <div className="h-[42vh] min-h-[260px] sm:h-[50vh]"><ScenePlayer key={run} scenes={scenes} width={editor.largura} height={editor.altura} start={index} startOffset={Math.max(0, time - elapsed)} playing={playing} noLoop /></div>;
  }
  if (!overlay) return <div className="grid h-[42vh] place-items-center rounded-lg border border-border bg-stage text-sm text-muted-foreground">Prévia indisponível</div>;
  const current = overlay.overlays.find((o) => time >= o.inicio && time < o.fim && o.html);
  return (
    <div ref={box} className="grid h-[42vh] min-h-[260px] place-items-center overflow-hidden rounded-lg bg-stage grid-lines sm:h-[50vh]">
      <div className="relative overflow-hidden bg-background shadow-glow" style={{ width: editor.largura * scale, height: editor.altura * scale }}>
        <video ref={videoRef} src={url} playsInline preload="auto" className="absolute inset-0 h-full w-full object-cover" style={camera(current?.camera, current ? current.fim - current.inicio : 0)} />
        {current?.html && <iframe key={`${current.id}-${run}`} title="Overlay da prévia" srcDoc={prepareSceneHtml(current.html, editor.largura, editor.altura)} sandbox="allow-scripts" className="pointer-events-none absolute left-0 top-0" style={{ width: editor.largura, height: editor.altura, transform: `scale(${scale})`, transformOrigin: "0 0", border: 0, background: "transparent", colorScheme: "normal" }} />}
      </div>
    </div>
  );
}
