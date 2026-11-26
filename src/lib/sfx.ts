export const TIPOS_SOM = ["whoosh", "impacto", "pop", "riser", "click", "ding", "glitch"] as const;
export interface Som { t: number; tipo: string }

let ctx: AudioContext | null = null;
let rec: MediaStreamAudioDestinationNode | null = null;
export function audioCtx() { if (!ctx) ctx = new AudioContext(); if (ctx.state === "suspended") void ctx.resume(); return ctx; }
export function recordDest() { const c = audioCtx(); if (!rec) rec = c.createMediaStreamDestination(); return rec; }
function out(c: AudioContext, vol: number) { const g = c.createGain(); g.gain.value = vol; g.connect(c.destination); if (rec) g.connect(rec); return g; }
function noise(c: AudioContext, sec: number) {
  const b = c.createBuffer(1, Math.ceil(c.sampleRate * sec), c.sampleRate); const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const s = c.createBufferSource(); s.buffer = b; return s;
}
function env(g: GainNode, t: number, a: number, r: number, peak = 1) {
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + r);
}
export function playSfx(tipo: string, vol = 0.5) {
  const c = audioCtx(); const o = out(c, vol); const t = c.currentTime;
  const osc = (type: OscillatorType, f0: number, f1: number, dur: number, peak = 1) => {
    const x = c.createOscillator(); const g = c.createGain(); x.type = type;
    x.frequency.setValueAtTime(f0, t); x.frequency.exponentialRampToValueAtTime(f1, t + dur);
    env(g, t, 0.005, dur, peak); x.connect(g).connect(o); x.start(t); x.stop(t + dur + 0.05);
  };
  const nz = (dur: number, type: BiquadFilterType, f0: number, f1: number, a: number, peak = 1) => {
    const s = noise(c, dur + 0.1); const f = c.createBiquadFilter(); const g = c.createGain(); f.type = type; f.Q.value = 1.5;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    env(g, t, a, dur - a, peak); s.connect(f).connect(g).connect(o); s.start(t); s.stop(t + dur + 0.1);
  };
  switch (tipo) {
    case "whoosh": nz(0.7, "bandpass", 300, 3500, 0.3); break;
    case "impacto": osc("sine", 140, 35, 0.6); nz(0.3, "lowpass", 2000, 200, 0.005, 0.8); break;
    case "pop": osc("sine", 700, 180, 0.09); break;
    case "riser": nz(1.6, "bandpass", 200, 7000, 1.4, 0.8); osc("sawtooth", 100, 800, 1.6, 0.08); break;
    case "click": nz(0.03, "highpass", 3000, 5000, 0.002); break;
    case "ding": osc("sine", 1320, 1310, 1.1, 0.6); osc("sine", 2640, 2630, 0.7, 0.2); break;
    case "glitch": for (let i = 0; i < 6; i++) { const x = c.createOscillator(); const g = c.createGain(); x.type = "square"; x.frequency.value = 80 + Math.random() * 900; const s = t + i * 0.04; g.gain.setValueAtTime(0.25, s); g.gain.setValueAtTime(0, s + 0.03); x.connect(g).connect(o); x.start(s); x.stop(s + 0.04); } break;
    default: osc("sine", 500, 300, 0.1);
  }
}
export function scheduleSons(sons: Som[] | undefined, enabled: boolean, offset = 0) {
  if (!enabled || !sons?.length) return () => {};
  const ids = sons.filter((s) => s.t >= offset).map((s) => setTimeout(() => playSfx(s.tipo), (s.t - offset) * 1000));
  return () => ids.forEach(clearTimeout);
}
