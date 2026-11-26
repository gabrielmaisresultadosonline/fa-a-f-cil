const K = "motionmro:openai";
export interface Creds { token?: string; modelo?: string }
export function getCreds(): Creds {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(K) || "{}") as Creds; } catch { return {}; }
}
export function setCreds(c: Creds) { localStorage.setItem(K, JSON.stringify(c)); }
export const MODELOS = ["gpt-4.1", "gpt-4.1-mini", "gpt-4o", "gpt-5", "gpt-5-mini", "o4-mini"];
