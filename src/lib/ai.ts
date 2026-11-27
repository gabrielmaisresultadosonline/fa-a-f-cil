import { runAgent } from "./agents.functions";
import { getCreds, MODELO_PADRAO } from "./settings";
import { logCusto, precoIA, type CustoMeta } from "./costs";

type Agente = "diretor" | "roteirista" | "desenvolvedor" | "overlay_plano" | "overlay_dev";
export async function callAgent(d: { agente: Agente; contexto: string; largura: number; altura: number; modelo?: string }, meta?: CustoMeta) {
  const c = getCreds();
  if (!c.token) throw new Error("Cadastre seu token da OpenAI em Administração.");
  const modelo = d.modelo || c.modelo || MODELO_PADRAO;
  const r = await runAgent({ data: { ...d, token: c.token, modelo } });
  if (meta) await logCusto(meta, { tipo: "ia", modelo, entrada: r.entrada, saida: r.saida, unidades: r.entrada + r.saida, usd: precoIA(modelo, r.entrada, r.saida) });
  return r;
}
