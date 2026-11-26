import { runAgent } from "./agents.functions";
import { getCreds, MODELO_PADRAO } from "./settings";

type Agente = "diretor" | "roteirista" | "desenvolvedor" | "overlay_plano" | "overlay_dev";
export async function callAgent(d: { agente: Agente; contexto: string; largura: number; altura: number }) {
  const c = getCreds();
  const data: Parameters<typeof runAgent>[0]["data"] = { ...d };
  if (!c.token) throw new Error("Cadastre seu token da OpenAI em Administração.");
  data.token = c.token;
  data.modelo = c.modelo || MODELO_PADRAO;
  return runAgent({ data });
}
