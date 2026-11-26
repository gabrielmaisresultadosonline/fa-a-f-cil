const K = "motionmro:openai";
export interface Precos {
  modelos: Record<string, { entrada: number; saida: number }>; // US$ por 1 milhão de tokens
  transcricaoMin: number; // US$ por minuto de áudio
  vozMilChars: number; // US$ por 1.000 caracteres (ElevenLabs)
  dolar: number; // R$ por US$
}
export interface Creds {
  token?: string; modelo?: string; servidor?: string;
  elevenToken?: string; voz?: string; vozNome?: string; vozModelo?: string;
  precos?: Precos;
}
export function getCreds(): Creds {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(K) || "{}") as Creds; } catch { return {}; }
}
export function setCreds(c: Creds) { localStorage.setItem(K, JSON.stringify({ ...getCreds(), ...c })); }
export const MODELO_PADRAO = "gpt-4.1-mini";
export const MODELOS: { id: string; nome: string }[] = [
  { id: "gpt-4.1-mini", nome: "GPT-4.1 mini — barato (padrão para testes)" },
  { id: "gpt-4o-mini", nome: "GPT-4o mini — o mais barato" },
  { id: "gpt-5-nano", nome: "GPT-5 nano — muito barato" },
  { id: "gpt-5-mini", nome: "GPT-5 mini — barato e bom" },
  { id: "gpt-4.1", nome: "GPT-4.1" },
  { id: "gpt-4o", nome: "GPT-4o" },
  { id: "o4-mini", nome: "o4-mini (raciocínio)" },
  { id: "gpt-5", nome: "GPT-5" },
  { id: "gpt-6.1-terra", nome: "GPT-6.1 Terra — topo de linha" },
];
export const SERVIDOR_PADRAO = "http://localhost:4400";
export const PRECOS_PADRAO: Precos = {
  modelos: {
    "gpt-4.1-mini": { entrada: 0.4, saida: 1.6 }, "gpt-4o-mini": { entrada: 0.15, saida: 0.6 },
    "gpt-5-nano": { entrada: 0.05, saida: 0.4 }, "gpt-5-mini": { entrada: 0.25, saida: 2 },
    "gpt-4.1": { entrada: 2, saida: 8 }, "gpt-4o": { entrada: 2.5, saida: 10 }, "o4-mini": { entrada: 1.1, saida: 4.4 },
    "gpt-5": { entrada: 1.25, saida: 10 }, "gpt-6.1-terra": { entrada: 5, saida: 20 },
  },
  transcricaoMin: 0.006, vozMilChars: 0.3, dolar: 5.5,
};
export function getPrecos(): Precos {
  const p = getCreds().precos;
  return { ...PRECOS_PADRAO, ...p, modelos: { ...PRECOS_PADRAO.modelos, ...p?.modelos } };
}
