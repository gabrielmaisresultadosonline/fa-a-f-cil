export const TIPOS_SOM = ["whoosh", "impacto", "pop", "riser", "click", "ding", "glitch"] as const;
export interface Som { t: number; tipo: string }

let ctx: AudioContext | null = null;
let rec: MediaStreamAudioDestinationNode | null = null;
export function audioCtx() { if (!ctx) ctx = new AudioContext(); if (ctx.state === "suspended") void ctx.resume(); return ctx; }
export function recordDest() { const c = audioCtx(); if (!rec) rec = c.createMediaStreamDestination(); return rec; }
function out(c: AudioContext, vol: number) { const g = c.createGain(); g.gain.value = vol; g.connect(c.destination); if (rec) g.connect(rec); return g; }
function noise(c: BaseAudioContext, sec: number) {
  const b = c.createBuffer(1, Math.ceil(c.sampleRate * sec), c.sampleRate); const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const s = c.createBufferSource(); s.buffer = b; return s;
}
function env(g: GainNode, t: number, a: number, r: number, peak = 1) {
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + r);
}
function synth(c: BaseAudioContext, o: AudioNode, tipo: string, t: number) {
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
export function playSfx(tipo: string, vol = 0.5) { const c = audioCtx(); synth(c, out(c, vol), tipo, c.currentTime); }

/** Gera a trilha de efeitos sonoros inteira como WAV (para renderização no servidor). */
export async function renderSfxWav(eventos: { t: number; tipo: string }[], duracao: number, vol = 0.5) {
  const rate = 48000; const c = new OfflineAudioContext(2, Math.ceil(duracao * rate), rate);
  const g = c.createGain(); g.gain.value = vol; g.connect(c.destination);
  for (const e of eventos) if (e.t < duracao) synth(c, g, e.tipo, Math.max(0, e.t));
  const buf = await c.startRendering();
  const L = buf.getChannelData(0), R = buf.getChannelData(1), n = L.length;
  const ab = new ArrayBuffer(44 + n * 4); const v = new DataView(ab);
  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, "RIFF"); v.setUint32(4, 36 + n * 4, true); w(8, "WAVE"); w(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 2, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 4, true); v.setUint16(32, 4, true); v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, n * 4, true);
  for (let i = 0; i < n; i++) { v.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i]!)) * 0x7fff, true); v.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i]!)) * 0x7fff, true); }
  return new Blob([ab], { type: "audio/wav" });
}
export function scheduleSons(sons: Som[] | undefined, enabled: boolean, offset = 0) {
  if (!enabled || !sons?.length) return () => {};
  const ids = sons.filter((s) => s.t >= offset).map((s) => setTimeout(() => playSfx(s.tipo), (s.t - offset) * 1000));
  return () => ids.forEach(clearTimeout);
}
