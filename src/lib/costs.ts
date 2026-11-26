import { get, set, keys, del } from "idb-keyval";
import { getPrecos } from "./settings";

export type TipoCusto = "ia" | "transcricao" | "voz" | "render";
export interface Custo {
  id: string; t: number; projetoId: string; projetoNome: string; modulo: "motion" | "overlay";
  tipo: TipoCusto; etapa: string; modelo: string; entrada: number; saida: number; unidades: number; usd: number;
}
export interface CustoMeta { projetoId: string; projetoNome: string; modulo: "motion" | "overlay"; etapa: string }
const P = "custo:";

export function precoIA(modelo: string, entrada: number, saida: number) {
  const m = getPrecos().modelos[modelo] ?? { entrada: 0, saida: 0 };
  return (entrada * m.entrada + saida * m.saida) / 1_000_000;
}
export async function logCusto(meta: CustoMeta, c: Omit<Custo, "id" | "t" | keyof CustoMeta>) {
  const x: Custo = { id: crypto.randomUUID(), t: Date.now(), ...meta, ...c };
  await set(P + x.t + ":" + x.id, x);
}
export async function listCustos() {
  const ks = (await keys()).filter((k) => String(k).startsWith(P));
  const pr = getPrecos();
  // recalcula com a tabela de preços atual
  return ((await Promise.all(ks.map((k) => get<Custo>(k)))).filter(Boolean) as Custo[]).map((c) => ({ ...c,
    usd: c.tipo === "ia" ? precoIA(c.modelo, c.entrada, c.saida) : c.tipo === "voz" ? (c.unidades / 1000) * pr.vozMilChars : c.tipo === "transcricao" ? c.unidades * pr.transcricaoMin : c.usd,
  })).sort((a, b) => b.t - a.t);
}
export async function limparCustos() {
  for (const k of (await keys()).filter((k) => String(k).startsWith(P))) await del(k);
}
export const fmtUSD = (v: number) => `US$ ${v < 0.01 ? v.toFixed(4) : v.toFixed(3)}`;
export const fmtBRL = (v: number) => `R$ ${(v * getPrecos().dolar).toFixed(v * getPrecos().dolar < 1 ? 3 : 2)}`;
