import { useEffect, useRef, useState, type Ref } from "react";
import type { Scene } from "@/lib/projects";
import { playBlob, scheduleSons } from "@/lib/sfx";
import { prepareSceneHtml } from "@/lib/sceneLayout";

export function ScenePlayer({ scenes, width, height, start = 0, playing, onIndex, loopSingle, sfx = false, voz = true, stageRef, noLoop }: {
  scenes: Scene[]; width: number; height: number; start?: number; playing: boolean; onIndex?: (i: number) => void; loopSingle?: boolean;
  sfx?: boolean; voz?: boolean; stageRef?: Ref<HTMLDivElement>; noLoop?: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.3);
  const [i, setI] = useState(start);
  const [nonce, setNonce] = useState(0);
  useEffect(() => setI(start), [start]);
  useEffect(() => {
    const el = box.current; if (!el) return;
    const ro = new ResizeObserver(() => setScale(Math.min(el.clientWidth / width, el.clientHeight / height)));
    ro.observe(el); return () => ro.disconnect();
  }, [width, height]);
  const cur = scenes[i];
  useEffect(() => { onIndex?.(i); }, [i, onIndex]);
  useEffect(() => {
    if (!playing || !cur) return;
    const cancel = scheduleSons(cur.sons, sfx);
    const stopVoz = voz && cur.audio ? playBlob(cur.audio) : () => {};
    const t = setTimeout(() => {
      if (loopSingle) setNonce((n) => n + 1);
      else if (noLoop && i === scenes.length - 1) return;
      else setI((x) => (x + 1) % scenes.length);
    }, cur.duracao * 1000);
    return () => { clearTimeout(t); cancel(); stopVoz(); };
  }, [playing, cur, scenes.length, loopSingle, nonce, i, sfx, noLoop, voz]);
  return (
    <div ref={box} className="relative grid h-full w-full place-items-center overflow-hidden rounded-lg bg-stage grid-lines">
      <div ref={stageRef} style={{ width: width * scale, height: height * scale }} className="relative overflow-hidden rounded-md shadow-glow">
        {cur?.html ? (
          <iframe key={`${cur.id}-${nonce}-${playing}`} title={cur.titulo} srcDoc={prepareSceneHtml(cur.html, width, height)} sandbox="allow-scripts"
            style={{ width, height, transform: `scale(${scale})`, transformOrigin: "0 0", border: 0 }} />
        ) : (
          <div className="grid h-full place-items-center bg-card text-sm text-muted-foreground">Cena ainda não programada</div>
        )}
      </div>
    </div>
  );
}
