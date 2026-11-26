const K = "motionmro:openai";
export interface Creds { token?: string; modelo?: string }
export function getCreds(): Creds {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(K) || "{}") as Creds; } catch { return {}; }
}
export function setCreds(c: Creds) { localStorage.setItem(K, JSON.stringify(c)); }
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
