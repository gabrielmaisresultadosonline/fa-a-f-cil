import { runAgent } from "./agents.functions";
import type { CustoMeta } from "./costs";

type Agente = "diretor" | "roteirista" | "desenvolvedor" | "overlay_plano" | "overlay_dev";
export async function callAgent(d: { agente: Agente; contexto: string; largura: number; altura: number; modelo?: string }, meta?: CustoMeta) {
  if (!meta) throw new Error("Produção sem projeto associado.");
  return runAgent({ data: { ...d, projectId:meta.projetoId,stage:meta.etapa } });
}
