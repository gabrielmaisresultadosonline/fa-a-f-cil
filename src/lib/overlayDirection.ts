import type { Overlay } from "./overlays";

export const OVERLAY_PLAN_PROMPT = `Você é o DIRETOR DE OVERLAYS de vídeo. Recebe a transcrição completa com tempos em segundos; entenda toda a fala e escolha frases-chave, títulos, números, listas e CTAs sincronizados com ela. O resultado é motion de impacto no QUADRO INTEIRO, não legendas pequenas nos cantinhos. Texto principal CENTRALIZADO nos dois eixos, grande, com hierarquia e quebras de linha adequadas ao formato. Não prefira terço inferior nem laterais. Pode cobrir temporariamente o apresentador nos destaques; depois revele o vídeo novamente. Não esconda a frase central para preservar o rosto.
Alterne estes modos conforme o sentido da fala: "escurecido" = vídeo ainda visível sob véu escuro de 65-80% cobrindo TODO o quadro quando entra o texto, com tipografia central e SVG/ícones pertinentes; "tela-cheia" = substitua temporariamente o vídeo por UMA COR SÓLIDA OPACA da paleta, contrastante com a tipografia central grande, números, ícones SVG ou formas. Use ambos os modos quando houver mais de um overlay; varie as cores sólidas entre destaques, não use só preto nem só textos transparentes. Em "descricao", dirija a cor sólida, hierarquia, gráficos, entrada e saída específicas. Entradas e saídas impactantes (wipe, máscara de texto, escala/punch, deslocamento por palavra, corte de cor) e leitura estável no meio; não repita a mesma transição em todas as frases. O escurecimento entra junto com o texto e sai com ele, revelando o vídeo.
Tudo responsivo ao WIDTHxHEIGHT: composição ocupa bem o quadro, sem cortes ou sobreposição de palavras, inclusive em vertical, quadrado e horizontal. Não confunda fundo full-bleed com texto cortado. Use frases curtas extraídas da fala; não invente afirmações. Overlays de 1.5 a 6 s, dentro do vídeo e sem sobreposição temporal. Movimento de câmera do vídeo: zoom-in, zoom-out, punch, pan-esquerda, pan-direita ou nenhum. Se o briefing pedir sons, preencha "sons" (t relativo ao início; tipo whoosh, impacto, pop, riser, click, ding ou glitch); senão []. Responda SOMENTE JSON: {"estilo":"paleta hex + fontes Google + linguagem visual","overlays":[{"inicio":0,"fim":3,"tipo":"titulo","texto":"","posicao":"centro","modo":"escurecido","descricao":"","camera":"punch","sons":[]}]}`;

export const OVERLAY_DEV_PROMPT = `Você é o DESENVOLVEDOR DE OVERLAYS de motion graphics. Escreva UM HTML completo e autocontido para UM overlay sobre um vídeo, CSS/JS inline, Google Fonts opcionais e GSAP em https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js. html/body transparentes, WIDTHxHEIGHT px, margin 0, overflow hidden. Crie uma camada de fundo ABSOLUTA inset:0 separada da composição de texto: ela cobre 100% do quadro sem ser reduzida junto com a tipografia. Posicione a composição principal no CENTRO horizontal E vertical (grid/flex), com largura útil de 80-90%, margens seguras, frases quebradas em linhas equilibradas, fonte grande ajustada ao espaço real e ícones SVG pertinentes. Não entregue um badge no canto, rodapé ou legenda minúscula. Pode cobrir temporariamente o rosto: o impacto central tem prioridade.
"escurecido": véu escuro de 65-80% sobre TODO o vídeo, entrando junto com o texto central; o vídeo permanece visível. "tela-cheia": UMA COR SÓLIDA 100% OPACA indicada na direção, cobrindo TODO o vídeo, com tipografia central de alto contraste e gráficos; não substitua por gradiente/transparência nem deixe só um retângulo atrás das letras. O modo legado "texto" mantém fundo transparente quando explicitamente solicitado, mas não é o padrão de novas criações. Respeite a cor e a hierarquia pedidas na descrição. Sem imagens externas; use SVG inline, formas e tipografia para ilustrar o assunto. Fundo sólido pode ser colorido, não precisa ser preto. Não desloque tudo para os cantos para evitar o rosto.
Construa entrada, tempo de leitura e saída: wipe de fundo, revelação por máscara/palavra, escala com impacto controlado, deslocamento/rotação curta e saída que revela o vídeo original. Texto fica completamente dentro do quadro durante a leitura, não sobrepõe ícones ou outras palavras; fundo e conteúdo devem sair antes do fim. Layout responsivo ao formato escolhido, preenchendo o quadro sem recortar informações. Use clamp/limites de fonte baseados no espaço disponível e quebras de linha, não uma linha comprida que escape. Ícones são apoio, não substituem o texto principal.
ANIMAÇÃO DETERMINÍSTICA para prévia e FFmpeg/HyperFrames: TODO movimento, inclusive fundo e transições, em UMA timeline GSAP síncrona no script ao fim do body: const tl = gsap.timeline(); window.__tl = tl; use posições explícitas e fromTo, começando em 0 e preenchendo a duração indicada. Sem load/DOMContentLoaded, CSS @keyframes, setTimeout, setInterval ou requestAnimationFrame (canvas só no onUpdate da tl). Responda SOMENTE HTML.`;

/** Normalize only planned/generated overlays; never rewrite saved HTML on load. */
export function centerOverlay<T extends Omit<Overlay, "id">>(overlay: T): T {
  return {
    ...overlay,
    posicao: "centro",
    modo: overlay.modo === "tela-cheia" ? "tela-cheia" : "escurecido",
  };
}

export function directOverlayPlan<T extends Omit<Overlay, "id">>(overlays: T[]): T[] {
  const centered = overlays.map(centerOverlay);
  // Keep the AI's rhythm; repair monotonous plans returned by smaller models.
  if (centered.length > 1 && !centered.some((overlay) => overlay.modo === "tela-cheia")) {
    return centered.map((overlay, index) => index % 3 === 1 ? { ...overlay, modo: "tela-cheia" } : overlay);
  }
  if (centered.length > 1 && centered.every((overlay) => overlay.modo === "tela-cheia")) {
    return centered.map((overlay, index) => index % 3 === 0 ? { ...overlay, modo: "escurecido" } : overlay);
  }
  return centered;
}