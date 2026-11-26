import { callAgent } from "./ai";
import { saveProject, type Project, type Scene } from "./projects";
import { gerarVoz } from "./tts";
import type { CustoMeta } from "./costs";

const meta = (p: Project, etapa: string): CustoMeta => ({ projetoId: p.id, projetoNome: p.config.nome, modulo: "motion", etapa });

export async function runPipeline(p: Project, onUpdate: (p: Project) => void) {
  const c = p.config;
  const push = async (agente: string, msg: string) => {
    p.log.push({ t: Date.now(), agente, msg });
    await saveProject(p);
    onUpdate({ ...p });
  };
  const brief = `Projeto: ${c.nome}\nIdeia: ${c.ideia}\nDuração total: ${c.duracao}s\nFormato: ${c.largura}x${c.altura}\nEstilo: ${c.estilo || "a IA decide"}\nPaleta: ${c.paleta || "a IA decide"}\nPúblico: ${c.publico || "a IA decide"}\nObjetivo: ${c.objetivo || "a IA decide"}\nIdioma dos textos: ${c.idioma}\nVelocidade: ${c.velocidade}\nIntensidade dos efeitos: ${c.intensidade}\nEfeitos sonoros: ${c.sons ? "SIM — escolha os melhores momentos" : "não"}\nMovimentos de câmera: sim, cinematográficos\nNarração por voz: ${c.voz ? "SIM — escreva o texto falado de cada cena" : "não"}`;
  const base = { largura: c.largura, altura: c.altura };
  p.status = "produzindo";
  try {
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
      p.agentes.roteirista = "concluido"; await push("Roteirista", `Roteiro com ${p.cenas.length} cenas.`);
    }
    p.agentes.desenvolvedor = "executando";
    for (let i = 0; i < p.cenas.length; i++) {
      const cena = p.cenas[i]!;
      if (cena.html) continue;
      await push("Dev. de Motion", `Programando cena ${i + 1}: ${cena.titulo}`);
      await generateScene(p, i);
    }
    p.agentes.desenvolvedor = "concluido";
    if (c.voz) {
      p.agentes.locutor = "executando";
      for (let i = 0; i < p.cenas.length; i++) {
        const cena = p.cenas[i]!;
        if (cena.audio) continue;
        const texto = (cena.narracao || [cena.textoPrincipal, cena.textoSecundario].filter(Boolean).join(". ")).trim();
        if (!texto) continue;
        await push("Locutor", `Gravando voz da cena ${i + 1}…`);
        cena.audio = await gerarVoz(texto, meta(p, `Voz — cena ${i + 1}`));
      }
      p.agentes.locutor = "concluido";
    }
    p.agentes.validador = "executando"; await push("Validador", "Validando cenas…");
    const problems = p.cenas.filter((x) => !x.html || !/<\/html>/i.test(x.html)).length;
    p.agentes.validador = "concluido";
    p.status = "pronto";
    await push("Validador", problems ? `${problems} cena(s) podem estar incompletas — regenere-as.` : "Todas as cenas aprovadas.");
  } catch (e) {
    for (const k of Object.keys(p.agentes) as (keyof Project["agentes"])[]) if (p.agentes[k] === "executando") p.agentes[k] = "erro";
    p.status = "erro";
    await push("Orquestrador", e instanceof Error ? e.message : "Erro desconhecido");
  }
}

export async function generateScene(p: Project, i: number, ajuste?: string) {
  const c = p.config;
  const cena = p.cenas[i]!;
  const prev = p.cenas[i - 1]; const next = p.cenas[i + 1];
  const ctx = `DIREÇÃO CRIATIVA:\n${p.direcao}\n\nCENA ${i + 1} de ${p.cenas.length} (duração ${cena.duracao}s):\n${JSON.stringify({ ...cena, html: undefined }, null, 2)}\n\nCena anterior: ${prev?.titulo ?? "nenhuma (abertura)"}\nPróxima cena: ${next?.titulo ?? "nenhuma (encerramento)"}\nIdioma: ${c.idioma}. Velocidade: ${c.velocidade}. Intensidade: ${c.intensidade}.${ajuste ? `\n\nAJUSTE PEDIDO PELO USUÁRIO: ${ajuste}${cena.html ? `\n\nCÓDIGO ATUAL:\n${cena.html.slice(0, 30000)}` : ""}` : ""}`;
  const r = await callAgent({ agente: "desenvolvedor", contexto: ctx, largura: c.largura, altura: c.altura }, meta(p, `Dev. de Motion — cena ${i + 1}`));
  cena.html = r.text;
  await saveProject(p);
}
