import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { CREATION_RULES } from "./projectBrief";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CAMERA = `MOVIMENTO DE CÂMERA (obrigatório, com qualidade cinematográfica): envolva todas as camadas num contêiner "câmera" com perspective e aplique movimentos contínuos ao longo da cena conforme o campo movimentoCamera (push-in/dolly lento, pan, tilt 3D, órbita, rack de profundidade com parallax entre camadas de frente/meio/fundo, whip-pan nas transições, shake sutil em impactos). Movimentos suaves com easing (power2/expo), nunca bruscos sem motivo.`;

const PROMPTS: Record<string, string> = {
  diretor: `Você é o DIRETOR CRIATIVO de um estúdio de motion graphics. Interprete a ideia e produza um documento curto de direção criativa em português com: Conceito, Objetivo, Público, Fundo, Paleta (com códigos hex), Tipografia (Google Fonts reais), Estilo de movimento, Linguagem de câmera (movimentos de câmera virtuais), Transições, Elementos visuais, Impacto esperado. Nunca repita a mesma estética genérica: adapte ao assunto. Responda em markdown conciso.`,
  roteirista: `Você é o ROTEIRISTA. Com base na direção criativa, crie o roteiro dividido em cenas cuja soma de durações seja igual à duração pedida (cenas de 3 a 7 s). Cada cena tem um movimentoCamera (ex.: "push-in lento com parallax", "pan lateral", "órbita 3D", "whip-pan de saída"). Se o briefing pedir efeitos sonoros, preencha "sons" com os momentos ideais (t = segundos desde o início da cena; tipo um de: whoosh, impacto, pop, riser, click, ding, glitch), sincronizados com entradas, impactos e transições; caso contrário deixe "sons": []. Se o briefing pedir narração por voz, escreva em "narracao" o texto falado da cena no idioma pedido, natural e envolvente, que caiba na duração (cerca de 2,5 palavras por segundo); caso contrário "narracao": "". Responda SOMENTE JSON válido no formato {"cenas":[{"titulo":"","duracao":4,"textoPrincipal":"","textoSecundario":"","descricaoVisual":"","animacao":"","movimentoCamera":"","transicaoEntrada":"","transicaoSaida":"","narracao":"","sons":[{"t":0.2,"tipo":"whoosh"}]}]}`,
  desenvolvedor: `Você é o DESENVOLVEDOR DE MOTION GRAPHICS sênior. Escreva UM documento HTML completo e autocontido para UMA cena de vídeo, com CSS e JavaScript inline (pode carregar Google Fonts e GSAP via CDN https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js). Regras: o body deve ter exatamente WIDTHxHEIGHT px, margin 0, overflow hidden. As animações começam automaticamente ao carregar e devem preencher toda a duração indicada, terminando com a transição de saída. Use tipografia cinética, camadas, profundidade, partículas/canvas/SVG quando fizer sentido, easing profissional. ${CAMERA} Siga fielmente a paleta e tipografia da direção criativa. Não use imagens externas. ANIMAÇÃO DETERMINÍSTICA (para renderizar em vídeo): construa todo o movimento numa única timeline GSAP criada de forma síncrona num <script> no fim do body: const tl = gsap.timeline(); window.__tl = tl; sem CSS @keyframes, setTimeout, setInterval ou requestAnimationFrame para o movimento (canvas só desenhado no onUpdate da tl). Responda SOMENTE com o HTML, sem markdown.`,
  overlay_plano: `Você é o DIRETOR DE OVERLAYS de vídeo. Você recebe a transcrição completa com tempos (em segundos) da fala de um vídeo. Entenda o assunto e crie overlays animados nos momentos certos: títulos, palavras‑chave, números/estatísticas, listas, nomes, chamadas para ação e frases de destaque — sincronizados exatamente com a fala, sem cobrir o rosto (prefira terço inferior, superior ou laterais). Defina também um movimento de câmera aplicado ao próprio vídeo em cada overlay: um de zoom-in, zoom-out, punch, pan-esquerda, pan-direita, nenhum. Se o briefing pedir efeitos sonoros, preencha "sons" (t = segundos desde o início do overlay; tipo: whoosh, impacto, pop, riser, click, ding, glitch); caso contrário "sons": []. Para cada overlay decida o "modo" de composição, alternando para criar ritmo e impacto (nunca todos iguais): "texto" = só tipografia cinética sobre o vídeo, sem fundo, fora do rosto; "escurecido" = vídeo escurecido por véu/gradiente escuro (60-80%) com textos, ícones SVG e formas por cima, preenchendo a área de forma responsiva; "tela-cheia" = momento de impacto que cobre TODO o quadro com fundo escuro opaco, textos grandes, ícones/ilustrações SVG, números, formas e transição de entrada/saída (use em números, listas, CTAs e frases-chave; ~25-35% dos overlays). Overlays de 1.5 a 6 s, sem sobreposição entre eles. Responda SOMENTE JSON: {"estilo":"paleta hex + fontes Google + linguagem visual","overlays":[{"inicio":0,"fim":3,"tipo":"titulo","texto":"","posicao":"inferior","modo":"texto","descricao":"","camera":"punch","sons":[{"t":0,"tipo":"pop"}]}]}`,
  overlay_dev: `Você é o DESENVOLVEDOR DE OVERLAYS de motion graphics. Escreva UM documento HTML completo e autocontido (CSS/JS inline; pode usar Google Fonts e GSAP via https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js) para UM overlay que será exibido POR CIMA de um vídeo. Regras: html e body com background TRANSPARENTE, exatamente WIDTHxHEIGHT px, margin 0, overflow hidden. Respeite o "modo" do overlay: "texto" = fundo transparente, ocupe só a área da posição indicada, sem cobrir o rosto, com sombra/contorno forte; "escurecido" = um véu escuro (#000 com 60-80% de opacidade ou gradiente escuro) cobrindo TODO o quadro animado com fade, e por cima textos grandes, ícones SVG inline, formas e destaques preenchendo a composição de forma responsiva; "tela-cheia" = fundo escuro OPACO cobrindo 100% do quadro (gradientes profundos, texturas/formas SVG), tipografia enorme, ícones/ilustrações SVG, números e elementos gráficos ocupando bem o formato, com transição de entrada (wipe/zoom/flash) e saída revelando o vídeo. Fundos sempre escuros e com contraste. Tudo dentro do quadro, sem cortar. Animação de entrada, permanência com micro‑movimento e saída, preenchendo exatamente a duração. Tipografia legível, sombras/contorno para contraste sobre qualquer vídeo, easing profissional, tipografia cinética. Sem imagens externas. ANIMAÇÃO DETERMINÍSTICA (obrigatório, para renderizar em vídeo com FFmpeg/HyperFrames): construa TODO o movimento numa única timeline GSAP criada de forma síncrona num <script> no fim do body (sem esperar load/DOMContentLoaded): const tl = gsap.timeline(); window.__tl = tl; use posições explícitas e fromTo. Não use CSS @keyframes, setTimeout, setInterval nem requestAnimationFrame para o movimento (canvas só se desenhado no onUpdate da tl). Responda SOMENTE com o HTML.`,
};

export const runAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      agente: z.enum(["diretor", "roteirista", "desenvolvedor", "overlay_plano", "overlay_dev"]),
      contexto: z.string().min(1).max(120000),
      largura: z.number().int().min(100).max(8000),
      altura: z.number().int().min(100).max(8000),
      projectId: z.uuid(),
      stage: z.string().min(1).max(160),
      modelo: z.string().max(80).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { studioSettings, openaiToken } = await import("./saas.server");
    const settings = await studioSettings();
    const token = await openaiToken();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data:generationId,error:denied } = await supabaseAdmin.rpc("generation_call",{p_user:context.userId,p_project:data.projectId});
    if (denied) throw new Error(denied.message);
    const prompt = PROMPTS[data.agente];
    if (!prompt) throw new Error("Agente desconhecido.");
    const system = `${prompt}\n\n${CREATION_RULES}`.replaceAll("WIDTH", String(data.largura)).replaceAll("HEIGHT", String(data.altura));
    let text = "", entrada = 0, saida = 0;
    if (token) {
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: settings.model, messages: [{ role: "system", content: system }, { role: "user", content: data.contexto }] }),
      });
      if (!r.ok) {
        await supabaseAdmin.rpc("finish_generation",{p_user:context.userId,p_project:data.projectId,p_failed:true});
        const t = await r.text();
        if (r.status === 401) throw new Error("Token da OpenAI inválido. Confira em Administração.");
        if (r.status === 404) throw new Error("O modelo configurado não está disponível na conta OpenAI do estúdio. Avise a administração.");
        if (r.status === 429) throw new Error("A OpenAI recusou por limite ou falta de saldo na sua conta.");
        throw new Error(`OpenAI ${r.status}: ${t.slice(0, 200)}`);
      }
      const j = (await r.json()) as { choices?: { message?: { content?: string } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } };
      text = j.choices?.[0]?.message?.content ?? "";
      entrada = j.usage?.prompt_tokens ?? 0; saida = j.usage?.completion_tokens ?? 0;
      const { error:costError } = await supabaseAdmin.from("usage_costs").insert({user_id:context.userId,project_id:data.projectId,generation_id:generationId,kind:"ia",stage:data.stage,model:settings.model,input_tokens:entrada,output_tokens:saida,units:entrada+saida});
      if (costError) throw new Error("Consumo recebido, mas o registro de custos falhou. Avise a administração.");
    } else {
      throw new Error("Cadastre seu token da OpenAI em Administração.");
    }
    text = text.replace(/^```[a-z]*\s*/i, "").replace(/```\s*$/i, "").trim();
    return { text, entrada, saida };
  });
