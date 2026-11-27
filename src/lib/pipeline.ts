import { callAgent } from "./ai";
import { saveProject, type Project, type Scene } from "./projects";
import type { CustoMeta } from "./costs";
import { buildMotionBrief } from "./projectBrief";
import { prepareSceneHtml, validateSceneLayout } from "./sceneLayout";
import { MODELO_SUPERVISOR } from "./settings";
import { reserveGeneration,completeGeneration } from "./saas.functions";

const meta = (p: Project, etapa: string): CustoMeta => ({ projetoId: p.id, projetoNome: p.config.nome, modulo: "motion", etapa });

export async function runPipeline(p: Project, onUpdate: (p: Project) => void) {
  const c = p.config;
  const push = async (agente: string, msg: string) => {
    p.log.push({ t: Date.now(), agente, msg });
    await saveProject(p);
    onUpdate({ ...p });
  };
  const brief = buildMotionBrief(c);
  const base = { largura: c.largura, altura: c.altura };
  p.status = "produzindo";
  try {
    await reserveGeneration({data:{projectId:p.id,seconds:Math.ceil(c.duracao)}});
    if (!p.direcao) {
      p.agentes.diretor = "executando"; await push("Diretor Criativo", "Interpretando a ideia…");
      const r = await callAgent({ ...base, agente: "diretor", contexto: brief }, meta(p, "Diretor Criativo"));
      p.direcao = r.text; p.agentes.diretor = "concluido"; await push("Diretor Criativo", "Direção criativa definida.");
    }
    if (!p.cenas.length) {
      p.agentes.roteirista = "executando"; await push("Roteirista", "Escrevendo o roteiro…");
      const r = await callAgent({ ...base, agente: "roteirista", contexto: `${brief}\n\nDIREÇÃO CRIATIVA:\n${p.direcao}` }, meta(p, "Roteirista"));
      const parsed = JSON.parse(r.text.slice(r.text.indexOf("{"), r.text.lastIndexOf("}") + 1)) as { cenas: Omit<Scene, "id">[] };
      p.cenas = parsed.cenas.map((x) => ({ ...x, duracao: Number(x.duracao) || 4, id: crypto.randomUUID() }));
      const total=p.cenas.reduce((sum,scene)=>sum+scene.duracao,0);
      if(!total)throw new Error("O roteiro não contém cenas.");
      p.cenas.forEach((scene)=>{scene.duracao=scene.duracao*c.duracao/total;});
      p.agentes.roteirista = "concluido"; await push("Roteirista", `Roteiro com ${p.cenas.length} cenas.`);
    }
    p.agentes.desenvolvedor = "executando";
    for (let i = 0; i < p.cenas.length; i++) {
      const cena = p.cenas[i];
      if (!cena) continue;
      if (cena.html) continue;
      await push("Dev. de Motion", `Programando cena ${i + 1}: ${cena.titulo}`);
      await generateScene(p, i, undefined, true);
    }
    p.agentes.desenvolvedor = "concluido";
    p.agentes.validador = "executando"; await push("Validador", "Validando cenas…");
    const totalSeconds=p.cenas.reduce((sum,scene)=>sum+scene.duracao,0);
    if(Math.abs(totalSeconds-c.duracao)>0.01)throw new Error("A duração final não corresponde ao pedido autorizado.");
    for (const scene of p.cenas) {
      if (!scene.html) throw new Error("Cena sem código. Continue a produção.");
      const issues = await validateSceneLayout(scene.html, c.largura, c.altura);
      if (issues.length) throw new Error(`Cena ${scene.titulo}: ${issues.join(" ")}`);
    }
    p.agentes.validador = "concluido";
    p.status = "pronto";
    await push("Validador", "Cenas verificadas no formato escolhido, com ajuste de enquadramento.");
    await completeGeneration({data:{projectId:p.id}});
  } catch (e) {
    for (const k of Object.keys(p.agentes) as (keyof Project["agentes"])[]) if (p.agentes[k] === "executando") p.agentes[k] = "erro";
    p.status = "erro";
    await push("Orquestrador", e instanceof Error ? e.message : "Erro desconhecido");
  }
}

export async function generateScene(p: Project, i: number, ajuste?: string, inPipeline=false) {
  const c = p.config;
  const cena = p.cenas[i];
  if (!cena) throw new Error("Cena não encontrada.");
  if(!inPipeline)await reserveGeneration({data:{projectId:p.id,seconds:Math.ceil(c.duracao)}});
  const prev = p.cenas[i - 1]; const next = p.cenas[i + 1];
  const ctx = `DIREÇÃO CRIATIVA:\n${p.direcao}\n\nCENA ${i + 1} de ${p.cenas.length} (duração ${cena.duracao}s):\n${JSON.stringify({ ...cena, html: undefined }, null, 2)}\n\nCena anterior: ${prev?.titulo ?? "nenhuma (abertura)"}\nPróxima cena: ${next?.titulo ?? "nenhuma (encerramento)"}\nIdioma: ${c.idioma}. Velocidade: ${c.velocidade}. Intensidade: ${c.intensidade}.${ajuste ? `\n\nAJUSTE PEDIDO PELO USUÁRIO: ${ajuste}${cena.html ? `\n\nCÓDIGO ATUAL:\n${cena.html.slice(0, 30000)}` : ""}` : ""}`;
  let issues: string[] = [];
  let html = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const contexto = attempt ? `${ctx}\n\nCORRIJA O ENQUADRAMENTO. A validação no navegador detectou: ${issues.join(" ")} Refaça a composição no formato ${c.largura}x${c.altura}, com todos os textos e ícones legíveis dentro do quadro.` : ctx;
    const r = await callAgent({ agente: "desenvolvedor", contexto, largura: c.largura, altura: c.altura, ...(attempt ? { modelo: MODELO_SUPERVISOR } : {}) }, meta(p, `Dev. de Motion — cena ${i + 1}${attempt ? " — correção de layout (supervisor)" : ""}`));
    html = prepareSceneHtml(r.text, c.largura, c.altura);
    issues = await validateSceneLayout(html, c.largura, c.altura);
    if (!issues.length) { cena.html = html; delete cena.htmlRejeitado; await saveProject(p); if(!inPipeline && p.status==="pronto")await completeGeneration({data:{projectId:p.id}}); return; }
  }
  cena.htmlRejeitado = html;
  await saveProject(p);
  throw new Error(`Cena ${i + 1} não aprovada: ${issues.join(" ")} (HTML rejeitado salvo na cena para inspeção.)`);
}
