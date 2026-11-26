import { runAgent } from "./agents.functions";
import { getCreds } from "./settings";

type Agente = "diretor" | "roteirista" | "desenvolvedor" | "overlay_plano" | "overlay_dev";
export async function callAgent(d: { agente: Agente; contexto: string; largura: number; altura: number }) {
  const c = getCreds();
  const data: Parameters<typeof runAgent>[0]["data"] = { ...d };
  if (c.token) data.token = c.token;
  if (c.modelo) data.modelo = c.modelo;
  return runAgent({ data });
}
