import { useEffect, useRef } from "react";

/** A live kinetic-type composition shared by the public pages. */
export function MotionShowcase({ compact = false }: { compact?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const ctx = el.getContext("2d");
    if (!ctx) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let width = 0;
    let height = 0;
    const css = getComputedStyle(el);
    const primary = css.getPropertyValue("--primary").trim();
    const accent = css.getPropertyValue("--accent").trim();
    const foreground = css.getPropertyValue("--foreground").trim();
    const background = css.getPropertyValue("--public-surface").trim();
    const resize = () => {
      const rect = el.getBoundingClientRect();
      width = rect.width; height = rect.height;
      el.width = Math.round(width * devicePixelRatio);
      el.height = Math.round(height * devicePixelRatio);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(el); resize();
    const draw = (time: number) => {
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
      ctx.clearRect(0, 0, width, height);
      const mobile = width < 768;
      const size = Math.min(compact ? 200 : mobile ? 195 : 365, height * .78, width * (compact ? .48 : mobile ? .55 : .31));
      const x = compact || mobile ? width / 2 : width * .765;
      const y = height * (compact ? .5 : mobile ? .51 : .48);
      const t = reduced.matches ? 0 : time / 1800;
      ctx.save(); ctx.translate(x, y);
      // Technical perspective rails, softly illuminated rather than decorative blobs.
      ctx.strokeStyle = accent; ctx.globalAlpha = .12; ctx.lineWidth = 1;
      for (let i = -4; i <= 4; i++) {
        ctx.beginPath(); ctx.moveTo(i * 72, -height); ctx.lineTo(i * 108, height); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-size * 1.4, i * 64); ctx.lineTo(size * 1.4, i * 64); ctx.stroke();
      }
      ctx.globalAlpha = .65;
      ctx.save(); ctx.rotate(-.13 + Math.sin(t) * .025);
      ctx.strokeStyle = accent; ctx.shadowColor = accent; ctx.shadowBlur = 18;
      ctx.strokeRect(-size * .54, -size * .51, size * 1.08, size * 1.04);
      ctx.restore();
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      ctx.save(); ctx.rotate(.065 + Math.sin(t * .8) * .025);
      ctx.fillStyle = background; ctx.fillRect(-size / 2, -size / 2, size, size);
      ctx.strokeStyle = primary; ctx.lineWidth = 1.5; ctx.shadowColor = primary; ctx.shadowBlur = 16;
      ctx.strokeRect(-size / 2, -size / 2, size, size); ctx.shadowBlur = 0;
      ctx.fillStyle = primary; ctx.fillRect(-size / 2, -size / 2, size, size * .07);
      ctx.textAlign = "left"; ctx.textBaseline = "middle";
      ctx.font = `500 ${size * .027}px 'JetBrains Mono', monospace`;
      ctx.fillStyle = background; ctx.fillText("MOTIONMRO  /  CREATIVE STUDIO", -size * .45, -size * .465);
      ctx.fillStyle = foreground; ctx.font = `700 ${size * .175}px 'Space Grotesk', sans-serif`;
      ctx.fillText("CRIE", -size * .41, -size * .19);
      ctx.fillStyle = primary; ctx.fillText("IMPACTO.", -size * .41, size * .015);
      ctx.fillStyle = accent;
      for (let i = 0; i < 9; i++) {
        const bar = size * (.06 + .08 * (1 + Math.sin(t * 2 + i * .7)));
        ctx.fillRect(-size * .41 + i * size * .047, size * .31 - bar, size * .025, bar);
      }
      ctx.fillStyle = foreground; ctx.font = `400 ${size * .028}px 'JetBrains Mono', monospace`;
      ctx.fillText("IDEIAS EM MOVIMENTO", -size * .41, size * .4);
      ctx.strokeStyle = accent; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(size * .25, size * .3); ctx.lineTo(size * .4, size * .15); ctx.lineTo(size * .4, size * .27); ctx.moveTo(size * .4, size * .15); ctx.lineTo(size * .28, size * .15); ctx.stroke();
      ctx.restore();
      ctx.fillStyle = primary;
      ctx.fillRect(-size * .7, size * .1 + Math.sin(t) * 12, size * .12, size * .22);
      ctx.fillStyle = accent;
      ctx.fillRect(size * .57, -size * .29 + Math.sin(t + 2) * 10, size * .15, size * .08);
      ctx.restore();
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [compact]);
  return <canvas ref={canvas} role="img" aria-label="MotionMRO: composição animada de tipografia, formas e luzes" className="pointer-events-none absolute inset-0 h-full w-full" />;
}
