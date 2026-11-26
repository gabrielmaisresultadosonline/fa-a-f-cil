import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const PROMPTS: Record<string, string> = {
  diretor: `Você é o DIRETOR CRIATIVO de um estúdio de motion graphics. Interprete a ideia e produza um documento curto de direção criativa em português com: Conceito, Objetivo, Público, Fundo, Paleta (com códigos hex), Tipografia (Google Fonts reais), Estilo de movimento, Transições, Elementos visuais, Impacto esperado. Nunca repita a mesma estética genérica: adapte ao assunto. Responda em markdown conciso.`,
  roteirista: `Você é o ROTEIRISTA. Com base na direção criativa, crie o roteiro dividido em cenas cuja soma de durações seja igual à duração pedida (cenas de 3 a 7 s). Responda SOMENTE JSON válido no formato {"cenas":[{"titulo":"","duracao":4,"textoPrincipal":"","textoSecundario":"","descricaoVisual":"","animacao":"","transicaoEntrada":"","transicaoSaida":""}]}`,
  desenvolvedor: `Você é o DESENVOLVEDOR DE MOTION GRAPHICS sênior. Escreva UM documento HTML completo e autocontido para UMA cena de vídeo, com CSS e JavaScript inline (pode carregar Google Fonts e GSAP via CDN https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js). Regras: o body deve ter exatamente WIDTHxHEIGHT px, margin 0, overflow hidden. As animações começam automaticamente ao carregar e devem preencher toda a duração indicada, terminando com a transição de saída. Use tipografia cinética, camadas, profundidade, partículas/canvas/SVG quando fizer sentido, easing profissional. Siga fielmente a paleta e tipografia da direção criativa. Não use imagens externas. Responda SOMENTE com o HTML, sem markdown.`,
};

export const runAgent = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      agente: z.enum(["diretor", "roteirista", "desenvolvedor"]),
      contexto: z.string().min(1).max(60000),
      largura: z.number().int().min(100).max(8000),
      altura: z.number().int().min(100).max(8000),
    }),
  )
  .handler(async ({ data }) => {
    const { generateResponse, GatewayError } = await import("@lovable.dev/ai-gateway");
    const system = PROMPTS[data.agente]!.replace("WIDTH", String(data.largura)).replace("HEIGHT", String(data.altura));
    try {
      const res = await generateResponse({
        model: "openai/gpt-6.1-terra",
        instructions: system,
        input: [{ role: "user", content: data.contexto }],
      });
      let text = "";
      for (const item of res.output ?? []) {
        if (item.type === "message") for (const c of item.content ?? []) if (c.type === "output_text") text += c.text;
      }
      text = text.replace(/^```[a-z]*\s*/i, "").replace(/```\s*$/i, "").trim();
      return { text };
    } catch (e) {
      if (e instanceof GatewayError) {
        if (e.httpStatus === 429) throw new Error("Muitas solicitações. Aguarde um momento e tente de novo.");
        if (e.httpStatus === 402) throw new Error("Créditos de IA esgotados. Adicione créditos ao workspace.");
        throw new Error(`Falha na IA: ${e.message}`);
      }
      throw e;
    }
  });
