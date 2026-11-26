import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const CAMERA = `MOVIMENTO DE CÂMERA (obrigatório, com qualidade cinematográfica): envolva todas as camadas num contêiner "câmera" com perspective e aplique movimentos contínuos ao longo da cena conforme o campo movimentoCamera (push-in/dolly lento, pan, tilt 3D, órbita, rack de profundidade com parallax entre camadas de frente/meio/fundo, whip-pan nas transições, shake sutil em impactos). Movimentos suaves com easing (power2/expo), nunca bruscos sem motivo.`;

const PROMPTS: Record<string, string> = {
  diretor: `Você é o DIRETOR CRIATIVO de um estúdio de motion graphics. Interprete a ideia e produza um documento curto de direção criativa em português com: Conceito, Objetivo, Público, Fundo, Paleta (com códigos hex), Tipografia (Google Fonts reais), Estilo de movimento, Linguagem de câmera (movimentos de câmera virtuais), Transições, Elementos visuais, Impacto esperado. Nunca repita a mesma estética genérica: adapte ao assunto. Responda em markdown conciso.`,
  roteirista: `Você é o ROTEIRISTA. Com base na direção criativa, crie o roteiro dividido em cenas cuja soma de durações seja igual à duração pedida (cenas de 3 a 7 s). Cada cena tem um movimentoCamera (ex.: "push-in lento com parallax", "pan lateral", "órbita 3D", "whip-pan de saída"). Se o briefing pedir efeitos sonoros, preencha "sons" com os momentos ideais (t = segundos desde o início da cena; tipo um de: whoosh, impacto, pop, riser, click, ding, glitch), sincronizados com entradas, impactos e transições; caso contrário deixe "sons": []. Responda SOMENTE JSON válido no formato {"cenas":[{"titulo":"","duracao":4,"textoPrincipal":"","textoSecundario":"","descricaoVisual":"","animacao":"","movimentoCamera":"","transicaoEntrada":"","transicaoSaida":"","sons":[{"t":0.2,"tipo":"whoosh"}]}]}`,
  desenvolvedor: `Você é o DESENVOLVEDOR DE MOTION GRAPHICS sênior. Escreva UM documento HTML completo e autocontido para UMA cena de vídeo, com CSS e JavaScript inline (pode carregar Google Fonts e GSAP via CDN https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js). Regras: o body deve ter exatamente WIDTHxHEIGHT px, margin 0, overflow hidden. As animações começam automaticamente ao carregar e devem preencher toda a duração indicada, terminando com a transição de saída. Use tipografia cinética, camadas, profundidade, partículas/canvas/SVG quando fizer sentido, easing profissional. ${CAMERA} Siga fielmente a paleta e tipografia da direção criativa. Não use imagens externas. Responda SOMENTE com o HTML, sem markdown.`,
  overlay_plano: `Você é o DIRETOR DE OVERLAYS de vídeo. Você recebe a transcrição completa com tempos (em segundos) da fala de um vídeo. Entenda o assunto e crie overlays animados nos momentos certos: títulos, palavras‑chave, números/estatísticas, listas, nomes, chamadas para ação e frases de destaque — sincronizados exatamente com a fala, sem cobrir o rosto (prefira terço inferior, superior ou laterais). Defina também um movimento de câmera aplicado ao próprio vídeo em cada overlay: um de zoom-in, zoom-out, punch, pan-esquerda, pan-direita, nenhum. Se o briefing pedir efeitos sonoros, preencha "sons" (t = segundos desde o início do overlay; tipo: whoosh, impacto, pop, riser, click, ding, glitch); caso contrário "sons": []. Overlays de 1.5 a 6 s, sem sobreposição entre eles. Responda SOMENTE JSON: {"estilo":"paleta hex + fontes Google + linguagem visual","overlays":[{"inicio":0,"fim":3,"tipo":"titulo","texto":"","posicao":"inferior","descricao":"","camera":"punch","sons":[{"t":0,"tipo":"pop"}]}]}`,
  overlay_dev: `Você é o DESENVOLVEDOR DE OVERLAYS de motion graphics. Escreva UM documento HTML completo e autocontido (CSS/JS inline; pode usar Google Fonts e GSAP via https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js) para UM overlay que será exibido POR CIMA de um vídeo. Regras: html e body com background TRANSPARENTE, exatamente WIDTHxHEIGHT px, margin 0, overflow hidden. Ocupe apenas a área da posição indicada, nunca cubra o quadro todo nem o centro do rosto. Animação de entrada, permanência com micro‑movimento e saída, preenchendo exatamente a duração. Tipografia legível, sombras/contorno para contraste sobre qualquer vídeo, easing profissional, tipografia cinética. Sem imagens externas. Responda SOMENTE com o HTML.`,
};

export const runAgent = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      agente: z.enum(["diretor", "roteirista", "desenvolvedor", "overlay_plano", "overlay_dev"]),
      contexto: z.string().min(1).max(120000),
      largura: z.number().int().min(100).max(8000),
      altura: z.number().int().min(100).max(8000),
      token: z.string().max(500).optional(),
      modelo: z.string().max(80).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const system = PROMPTS[data.agente]!.replaceAll("WIDTH", String(data.largura)).replaceAll("HEIGHT", String(data.altura));
    let text = "";
    if (data.token) {
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${data.token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: data.modelo || "gpt-4.1", messages: [{ role: "system", content: system }, { role: "user", content: data.contexto }] }),
      });
      if (!r.ok) {
        const t = await r.text();
        if (r.status === 401) throw new Error("Token da OpenAI inválido. Confira em Administração.");
        if (r.status === 429) throw new Error("A OpenAI recusou por limite ou falta de saldo na sua conta.");
        throw new Error(`OpenAI ${r.status}: ${t.slice(0, 200)}`);
      }
      const j = (await r.json()) as { choices?: { message?: { content?: string } }[] };
      text = j.choices?.[0]?.message?.content ?? "";
    } else {
      const { generateResponse, GatewayError } = await import("@lovable.dev/ai-gateway");
      try {
        const res = await generateResponse({ model: "openai/gpt-6.1-terra", instructions: system, input: [{ role: "user", content: data.contexto }] });
        for (const item of res.output ?? []) if (item.type === "message") for (const c of item.content ?? []) if (c.type === "output_text") text += c.text;
      } catch (e) {
        if (e instanceof GatewayError) {
          if (e.httpStatus === 429) throw new Error("Muitas solicitações. Aguarde um momento e tente de novo.");
          if (e.httpStatus === 402) throw new Error("Créditos de IA esgotados. Cadastre seu token da OpenAI em Administração.");
          throw new Error(`Falha na IA: ${e.message}`);
        }
        throw e;
      }
    }
    text = text.replace(/^```[a-z]*\s*/i, "").replace(/```\s*$/i, "").trim();
    return { text };
  });
