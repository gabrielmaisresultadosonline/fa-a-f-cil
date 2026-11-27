import { createId } from "./uuid";
import { callAgent } from "./ai";
import { getCreds } from "./settings";
import { transcribe } from "./transcribe";
import { saveOverlay, type Overlay, type OverlayProject } from "./overlays";
import { logCusto, type CustoMeta } from "./costs";
import { getPrecos } from "./settings";
import { prepareSceneHtml, validateSceneLayout } from "./sceneLayout";
import { reserveGeneration,completeGeneration } from "./saas.functions";
import { centerOverlay, directOverlayPlan } from "./overlayDirection";

const meta = (p: OverlayProject, etapa: string): CustoMeta => ({ projetoId: p.id, projetoNome: p.nome, modulo: "overlay", etapa });

function observationBrief(p: OverlayProject) {
  const notes = p.observacoes?.trim();
  return notes ? `\n\nOBSERVAÇÕES DO CLIENTE (direção criativa, não texto para exibir):\n${notes}\nAplique as cores e preferências solicitadas, preservando as regras obrigatórias de contraste, enquadramento e impacto.` : "";
}

export async function runOverlayPipeline(p: OverlayProject, onUpdate: (p: OverlayProject) => void) {
  const push = async (msg: string) => { p.log.push({ t: Date.now(), msg }); await saveOverlay(p); onUpdate({ ...p }); };
  p.status = "produzindo";
  try {
    await reserveGeneration({data:{projectId:p.id,seconds:Math.ceil(p.duracao)}});
    if (!p.transcricao) {
      await push("Ouvindo e transcrevendo a voz do vídeo…");
      p.transcricao = await transcribe(p.video, p.id);
      await push(`Transcrição pronta: ${p.transcricao.length} trechos.`);
    }
    if (!p.overlays.length) {
      await push("Planejando overlays, câmera e sons…");
      const ctx = `Vídeo: ${p.largura}x${p.altura}, ${p.duracao.toFixed(1)}s.\nEfeitos sonoros: ${p.sons ? "SIM" : "não"}.\n\nTRANSCRIÇÃO:\n${p.transcricao.map((s) => `[${s.inicio}-${s.fim}] ${s.texto}`).join("\n")}${observationBrief(p)}`;
      const r = await callAgent({ agente: "overlay_plano", contexto: ctx, largura: p.largura, altura: p.altura }, meta(p, "Planejamento de overlays"));
      const j = JSON.parse(r.text.slice(r.text.indexOf("{"), r.text.lastIndexOf("}") + 1)) as { estilo: string; overlays: Omit<Overlay, "id">[] };
      p.estilo = j.estilo;
      const planned = j.overlays.map((o) => ({ ...o, inicio: Number(o.inicio), fim: Number(o.fim), id: createId() })).sort((a, b) => a.inicio - b.inicio);
      p.overlays = directOverlayPlan(planned);
      await push(`${p.overlays.length} overlays planejados.`);
    }
    for (let i = 0; i < p.overlays.length; i++) {
      const overlay=p.overlays[i];if(!overlay||overlay.html)continue;
      await push(`Animando overlay ${i + 1}/${p.overlays.length}: ${overlay.texto}`);
      await generateOverlay(p, i,undefined,true);
    }
    p.status = "pronto"; await push("Overlays prontos.");
    await completeGeneration({data:{projectId:p.id}});
  } catch (e) {
    p.status = "erro"; await push(e instanceof Error ? e.message : "Erro desconhecido");
  }
}

export async function generateOverlay(p: OverlayProject, i: number, ajuste?: string,inPipeline=false) {
  const saved = p.overlays[i];
  if (!saved) throw new Error("Overlay não encontrado.");
  const o = centerOverlay(saved);
  if(!inPipeline)await reserveGeneration({data:{projectId:p.id,seconds:Math.ceil(p.duracao)}});
  const ctx = `ESTILO: ${p.estilo}\n\nOVERLAY (duração ${(o.fim - o.inicio).toFixed(2)}s):\n${JSON.stringify({ ...o, html: undefined }, null, 2)}${observationBrief(p)}${ajuste ? `\n\nAJUSTE PEDIDO: ${ajuste}${o.html ? `\n\nCÓDIGO ATUAL:\n${o.html.slice(0, 30000)}` : ""}` : ""}`;
  let issues: string[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    const contexto = attempt ? `${ctx}\n\nCorrija o layout no formato ${p.largura}x${p.altura}: ${issues.join(" ")} Mantenha textos e ícones dentro do quadro, com texto principal centralizado e fundo cobrindo todo o formato. Não mova a composição para o canto para preservar o rosto.` : ctx;
    const r = await callAgent({ agente: "overlay_dev", contexto, largura: p.largura, altura: p.altura }, meta(p, `Overlay ${i + 1}${attempt ? " — correção de layout" : ""}`));
    const html = prepareSceneHtml(r.text, p.largura, p.altura);
    issues = await validateSceneLayout(html, p.largura, p.altura);
    if (!issues.length) { o.html = html; p.overlays[i] = o; await saveOverlay(p);if(!inPipeline && p.status==="pronto")await completeGeneration({data:{projectId:p.id}}); return; }
  }
  throw new Error(`Overlay ${i + 1} não aprovado: ${issues.join(" ")}`);
}
