import { get, set, keys, del } from "idb-keyval";
import { getPrecos } from "./settings";
import { supabase } from "@/integrations/supabase/client";

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
  const {data:rows,error}=await supabase.from("usage_costs").select("*,profiles(name)").order("created_at",{ascending:false}).limit(500);
  if(error)throw new Error("Histórico de custos exclusivo da administração.");
  const pr = getPrecos();
  // recalcula com a tabela de preços atual
  const ids=[...new Set((rows??[]).map((r)=>r.project_id))];
  const projects=ids.length?await supabase.from("customer_projects").select("id,name,kind").in("id",ids).limit(500):{data:[]};
  return (rows??[]).map((r):Custo=>({id:r.id,t:Date.parse(r.created_at),projetoId:r.project_id,projetoNome:`${r.profiles?.name||"Cliente"} — ${projects.data?.find((p)=>p.id===r.project_id)?.name||r.project_id}`,modulo:projects.data?.find((p)=>p.id===r.project_id)?.kind==="overlay"?"overlay":"motion",tipo:r.kind as TipoCusto,etapa:r.stage,modelo:r.model,entrada:r.input_tokens,saida:r.output_tokens,unidades:Number(r.units),usd:0})).map((c) => ({ ...c,
    usd: c.tipo === "ia" ? precoIA(c.modelo, c.entrada, c.saida) : c.tipo === "voz" ? (c.unidades / 1000) * pr.vozMilChars : c.tipo === "transcricao" ? c.unidades * pr.transcricaoMin : c.usd,
  })).sort((a, b) => b.t - a.t);
}
export async function limparCustos() {
  throw new Error("O histórico de consumo em nuvem é preservado para auditoria.");
}
export const fmtUSD = (v: number) => `US$ ${v < 0.01 ? v.toFixed(4) : v.toFixed(3)}`;
export const fmtBRL = (v: number) => `R$ ${(v * getPrecos().dolar).toFixed(v * getPrecos().dolar < 1 ? 3 : 2)}`;
