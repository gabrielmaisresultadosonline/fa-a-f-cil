const K = "motionmro:openai";
export interface Precos {
  modelos: Record<string, { entrada: number; saida: number; cache?: number }>; // US$ por 1 milhão de tokens (cache = entrada reaproveitada)
  transcricaoMin: number; // US$ por minuto de áudio
  vozMilChars: number; // US$ por 1.000 caracteres (ElevenLabs)
  dolar: number; // R$ por US$
}
export interface Creds {
  token?: string; modelo?: string; servidor?: string;
  elevenToken?: string; voz?: string; vozNome?: string; vozModelo?: string;
  precos?: Precos; motor?: "ffmpeg" | "hyperframes";
}
export function getCreds(): Creds {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(K) || "{}") as Creds; } catch { return {}; }
}
export function setCreds(c: Creds) { localStorage.setItem(K, JSON.stringify({ ...getCreds(), ...c })); }
let publicSettings: Creds = {};
export function setPublicSettings(c: Creds) { publicSettings = c; }
export function getStudioSettings(): Creds { return publicSettings; }
export const MODELO_PADRAO = "gpt-6.1-terra";
export const MODELO_SUPERVISOR = "gpt-6.1-terra";
export const MODELOS: { id: string; nome: string }[] = [
  { id: "gpt-6.1-terra", nome: "Terra — topo de linha" },
];
export const SERVIDOR_PADRAO = "http://localhost:4400";
export const PRECOS_PADRAO: Precos = {
  modelos: {
    "gpt-6.1-terra": { entrada: 1, saida: 5, cache: 0.05 }, // preço oficial OpenAI
  },
  transcricaoMin: 0.006, vozMilChars: 0.3, dolar: 5.5,
};
export function getPrecos(): Precos {
  const p = publicSettings.precos ?? getCreds().precos;
  return { ...PRECOS_PADRAO, ...p, modelos: { ...PRECOS_PADRAO.modelos, ...p?.modelos } };
}
/** Endereço do servidor de renderização visto pelo navegador: em página HTTPS, um endereço HTTP antigo (IP:4400) seria bloqueado, então usa o proxy /render do próprio domínio. */
export function resolveRenderBase(url?: string) {
  const base = (url || SERVIDOR_PADRAO).replace(/\/+$/, "");
  if (typeof window === "undefined") return base;
  const { protocol, origin, hostname } = window.location;
  if (protocol === "https:" && base.startsWith("http:") && hostname !== "localhost") return `${origin}/render`;
  return base;
}
