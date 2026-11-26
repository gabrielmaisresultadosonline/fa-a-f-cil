import { callAgent } from "./ai";
import { getCreds } from "./settings";
import { transcribe } from "./transcribe";
import { saveOverlay, type Overlay, type OverlayProject } from "./overlays";
import { logCusto, type CustoMeta } from "./costs";
import { getPrecos } from "./settings";
import { prepareSceneHtml, validateSceneLayout } from "./sceneLayout";

const meta = (p: OverlayProject, etapa: string): CustoMeta => ({ projetoId: p.id, projetoNome: p.nome, modulo: "overlay", etapa });

export async function runOverlayPipeline(p: OverlayProject, onUpdate: (p: OverlayProject) => void) {
  const push = async (msg: string) => { p.log.push({ t: Date.now(), msg }); await saveOverlay(p); onUpdate({ ...p }); };
  p.status = "produzindo";
  try {
    if (!p.transcricao) {
      const { token } = getCreds();
      if (!token) throw new Error("Cadastre seu token da OpenAI em Administração para transcrever a voz.");
      await push("Ouvindo e transcrevendo a voz do vídeo…");
      p.transcricao = await transcribe(p.video, token);
      await logCusto(meta(p, "Transcrição da voz"), { tipo: "transcricao", modelo: "whisper-1", entrada: 0, saida: 0, unidades: p.duracao / 60, usd: (p.duracao / 60) * getPrecos().transcricaoMin });
      await push(`Transcrição pronta: ${p.transcricao.length} trechos.`);
    }
    if (!p.overlays.length) {
      await push("Planejando overlays, câmera e sons…");
      const ctx = `Vídeo: ${p.largura}x${p.altura}, ${p.duracao.toFixed(1)}s.\nEfeitos sonoros: ${p.sons ? "SIM" : "não"}.\n\nTRANSCRIÇÃO:\n${p.transcricao.map((s) => `[${s.inicio}-${s.fim}] ${s.texto}`).join("\n")}`;
      const r = await callAgent({ agente: "overlay_plano", contexto: ctx, largura: p.largura, altura: p.altura }, meta(p, "Planejamento de overlays"));
      const j = JSON.parse(r.text.slice(r.text.indexOf("{"), r.text.lastIndexOf("}") + 1)) as { estilo: string; overlays: Omit<Overlay, "id">[] };
      p.estilo = j.estilo;
      p.overlays = j.overlays.map((o) => ({ ...o, inicio: Number(o.inicio), fim: Number(o.fim), id: crypto.randomUUID() })).sort((a, b) => a.inicio - b.inicio);
      await push(`${p.overlays.length} overlays planejados.`);
    }
    for (let i = 0; i < p.overlays.length; i++) {
      if (p.overlays[i]!.html) continue;
      await push(`Animando overlay ${i + 1}/${p.overlays.length}: ${p.overlays[i]!.texto}`);
      await generateOverlay(p, i);
    }
    p.status = "pronto"; await push("Overlays prontos.");
  } catch (e) {
    p.status = "erro"; await push(e instanceof Error ? e.message : "Erro desconhecido");
  }
}

export async function generateOverlay(p: OverlayProject, i: number, ajuste?: string) {
  const o = p.overlays[i];
  if (!o) throw new Error("Overlay não encontrado.");
  const ctx = `ESTILO: ${p.estilo}\n\nOVERLAY (duração ${(o.fim - o.inicio).toFixed(2)}s):\n${JSON.stringify({ ...o, html: undefined }, null, 2)}${ajuste ? `\n\nAJUSTE PEDIDO: ${ajuste}${o.html ? `\n\nCÓDIGO ATUAL:\n${o.html.slice(0, 30000)}` : ""}` : ""}`;
  let issues: string[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    const contexto = attempt ? `${ctx}\n\nCorrija o layout no formato ${p.largura}x${p.altura}: ${issues.join(" ")} Mantenha todos os textos e ícones dentro do quadro, sem cobrir o rosto.` : ctx;
    const r = await callAgent({ agente: "overlay_dev", contexto, largura: p.largura, altura: p.altura }, meta(p, `Overlay ${i + 1}${attempt ? " — correção de layout" : ""}`));
    const html = prepareSceneHtml(r.text, p.largura, p.altura);
    issues = await validateSceneLayout(html, p.largura, p.altura);
    if (!issues.length) { o.html = html; await saveOverlay(p); return; }
  }
  throw new Error(`Overlay ${i + 1} não aprovado: ${issues.join(" ")}`);
}
