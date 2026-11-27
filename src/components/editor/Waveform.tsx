import { useEffect, useRef } from "react";

/** Draws peaks for the source range [from, to] (seconds) of a track lasting `total` seconds. */
export function Waveform({ peaks, total, from, to, className = "" }: { peaks?: Float32Array | undefined; total: number; from: number; to: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas || !peaks || total <= 0) return;
    const draw = () => {
      const w = canvas.clientWidth, h = canvas.clientHeight, dpr = window.devicePixelRatio || 1;
      if (!w || !h) return;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      const ctx = canvas.getContext("2d"); if (!ctx) return;
      ctx.scale(dpr, dpr); ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = getComputedStyle(canvas).color;
      const a = (from / total) * peaks.length, b = (to / total) * peaks.length;
      for (let x = 0; x < w; x++) {
        const i0 = Math.floor(a + ((b - a) * x) / w), i1 = Math.max(i0 + 1, Math.floor(a + ((b - a) * (x + 1)) / w));
        let max = 0; for (let i = i0; i < i1 && i < peaks.length; i++) { const v = peaks[i] ?? 0; if (v > max) max = v; }
        const bar = Math.max(1, max * h * 0.9);
        ctx.fillRect(x, (h - bar) / 2, 1, bar);
      }
    };
    draw();
    const observer = new ResizeObserver(draw); observer.observe(canvas);
    return () => observer.disconnect();
  }, [peaks, total, from, to]);
  return <canvas ref={ref} aria-hidden className={`pointer-events-none block h-full w-full ${className}`} />;
}
