import { getCreds, getPrecos } from "./settings";
import { logCusto, type CustoMeta } from "./costs";

export interface Voz { voice_id: string; name: string; labels?: Record<string, string>; preview_url?: string }
export async function listarVozes(token: string): Promise<Voz[]> {
  const r = await fetch("https://api.elevenlabs.io/v1/voices", { headers: { "xi-api-key": token } });
  if (!r.ok) throw new Error(r.status === 401 ? "Token da ElevenLabs inválido." : `ElevenLabs ${r.status}`);
  return ((await r.json()) as { voices: Voz[] }).voices;
}
export async function gerarVoz(texto: string, meta?: CustoMeta) {
  const c = getCreds();
  if (!c.elevenToken) throw new Error("Cadastre o token da ElevenLabs em Administração para gerar a voz.");
  if (!c.voz) throw new Error("Escolha uma voz em Administração.");
  const modelo = c.vozModelo || "eleven_multilingual_v2";
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${c.voz}?output_format=mp3_44100_128`, {
    method: "POST", headers: { "xi-api-key": c.elevenToken, "Content-Type": "application/json" },
    body: JSON.stringify({ text: texto, model_id: modelo, voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.4, use_speaker_boost: true } }),
  });
  if (!r.ok) throw new Error(r.status === 401 ? "Token da ElevenLabs inválido." : `ElevenLabs ${r.status}: ${(await r.text()).slice(0, 160)}`);
  if (meta) await logCusto(meta, { tipo: "voz", modelo, entrada: texto.length, saida: 0, unidades: texto.length, usd: (texto.length / 1000) * getPrecos().vozMilChars });
  return new Blob([await r.arrayBuffer()], { type: "audio/mpeg" });
}
