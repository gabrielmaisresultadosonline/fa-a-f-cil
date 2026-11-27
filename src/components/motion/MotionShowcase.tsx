import { useEffect, useRef } from "react";
// An actual animated motion composition, not a stock image of a video editor.
export function MotionShowcase() {
  const canvas=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{
    const el=canvas.current;if(!el)return; const ctx=el.getContext("2d");if(!ctx)return;
    let frame=0;const reduced=matchMedia("(prefers-reduced-motion: reduce)").matches;
    const draw=(time:number)=>{
      const rect=el.getBoundingClientRect();el.width=rect.width*devicePixelRatio;el.height=rect.height*devicePixelRatio;ctx.scale(devicePixelRatio,devicePixelRatio);
      const w=rect.width,h=rect.height;const css=getComputedStyle(el); const primary=css.getPropertyValue("--primary").trim(); const accent=css.getPropertyValue("--accent").trim();
      ctx.clearRect(0,0,w,h);ctx.strokeStyle=accent;ctx.lineWidth=2;
      const t=reduced?0:time/1600;
      for(let i=0;i<5;i++){const x=w*(.55+i*.085),y=h*.53+Math.sin(t+i)*30;ctx.save();ctx.translate(x,y);ctx.rotate(t*.2+i*.4);ctx.strokeRect(-45-i*5,-45-i*5,90+i*10,90+i*10);ctx.restore();}
      if(!reduced)frame=requestAnimationFrame(draw);
    };frame=requestAnimationFrame(draw);return()=>cancelAnimationFrame(frame);
  },[]);
  return <canvas ref={canvas} aria-label="Composição MotionMRO com formas animadas" className="absolute inset-0 h-full w-full opacity-15 lg:opacity-40"/>;
}