import { useEffect, useRef, useState } from "react";
import type { Scene } from "@/lib/projects";

export function ScenePlayer({ scenes, width, height, start = 0, playing, onIndex, loopSingle }: {
  scenes: Scene[]; width: number; height: number; start?: number; playing: boolean; onIndex?: (i: number) => void; loopSingle?: boolean;
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
    const t = setTimeout(() => {
      if (loopSingle) setNonce((n) => n + 1); else setI((x) => (x + 1) % scenes.length);
    }, cur.duracao * 1000);
    return () => clearTimeout(t);
  }, [playing, cur, scenes.length, loopSingle, nonce, i]);
  return (
    <div ref={box} className="relative grid h-full w-full place-items-center overflow-hidden rounded-lg bg-stage grid-lines">
      <div style={{ width: width * scale, height: height * scale }} className="relative overflow-hidden rounded-md shadow-glow">
        {cur?.html ? (
          <iframe key={`${cur.id}-${nonce}-${playing}`} title={cur.titulo} srcDoc={cur.html} sandbox="allow-scripts"
            style={{ width, height, transform: `scale(${scale})`, transformOrigin: "0 0", border: 0 }} />
        ) : (
          <div className="grid h-full place-items-center bg-card text-sm text-muted-foreground">Cena ainda não programada</div>
        )}
      </div>
    </div>
  );
}
