import type { Segmento } from "./overlays";

function encodeWav(data: Float32Array, rate: number) {
  const buf = new ArrayBuffer(44 + data.length * 2); const v = new DataView(buf);
  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, "RIFF"); v.setUint32(4, 36 + data.length * 2, true); w(8, "WAVE"); w(12, "fmt "); v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, data.length * 2, true);
  for (let i = 0; i < data.length; i++) { const s = Math.max(-1, Math.min(1, data[i]!)); v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true); }
  return new Blob([buf], { type: "audio/wav" });
}

/** Extrai a voz do vídeo como WAV mono 16 kHz (até ~13 min cabem no limite de 25 MB). */
export async function extractWav(video: Blob) {
  const ac = new AudioContext();
  const decoded = await ac.decodeAudioData(await video.arrayBuffer()); void ac.close();
  const rate = 16000;
  const off = new OfflineAudioContext(1, Math.ceil(decoded.duration * rate), rate);
  const src = off.createBufferSource(); src.buffer = decoded; src.connect(off.destination); src.start();
  return encodeWav((await off.startRendering()).getChannelData(0), rate);
}

export async function transcribe(video: Blob, token: string): Promise<Segmento[]> {
  const wav = await extractWav(video);
  if (wav.size > 25 * 1024 * 1024) throw new Error("Áudio longo demais para transcrever (máx. ~13 min).");
  const fd = new FormData();
  fd.append("file", wav, "audio.wav"); fd.append("model", "whisper-1");
  fd.append("response_format", "verbose_json"); fd.append("timestamp_granularities[]", "segment");
  const r = await fetch("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
  if (!r.ok) throw new Error(r.status === 401 ? "Token da OpenAI inválido." : `Transcrição falhou (${r.status}): ${(await r.text()).slice(0, 160)}`);
  const j = (await r.json()) as { segments?: { start: number; end: number; text: string }[]; text?: string };
  return (j.segments ?? []).map((s) => ({ inicio: +s.start.toFixed(2), fim: +s.end.toFixed(2), texto: s.text.trim() }));
}
