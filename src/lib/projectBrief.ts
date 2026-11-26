import type { Project, ProjectConfig } from "./projects";

export const CREATION_RULES = `O nome do projeto é apenas organização externa: nunca inclua o nome do projeto como texto, marca, título ou narração no vídeo. Use somente o conteúdo solicitado na ideia ou na fala original.
QUALIDADE OBRIGATÓRIA EM TODOS OS MODELOS, INCLUSIVE MINI/NANO: componha especificamente para WIDTH x HEIGHT, não copie um layout horizontal para vídeo vertical. O fundo preenche 100% do quadro, sem moldura, barras internas, cartão central pequeno ou espaço morto sem intenção. Distribua hierarquia, elementos visuais e textos por todo o formato, mantendo área segura de 6% nas bordas. Textos legíveis, sem cortes e sem sobreposição entre blocos. Não use nowrap, ellipsis, line-clamp ou overflow:hidden para esconder texto. Use grid/flex com min-width:0, quebras de linha e fonte adequada ao espaço. Conteúdo principal deve continuar dentro do quadro durante os movimentos de câmera; reserve espaço para o zoom e parallax.
ACABAMENTO: crie ícones SVG inline com viewBox, ilustrações vetoriais próprias, gráficos ou objetos visuais pertinentes ao assunto, não apenas texto e partículas genéricas. Imagens só autocontidas (data URI) quando disponíveis; nunca invente URLs ou deixe recursos quebrados. Não é necessário comprar imagens nem usar outro modelo. Ajuste a quantidade de conteúdo à duração; poucos elementos bem desenhados são melhores que muitos blocos apertados.
CONTRATO HTML: fundo decorativo em camada separada, position:absolute;inset:0. Todo texto/ícone/ilustração essencial dentro de #motion-content, width:WIDTHpx;height:HEIGHTpx;box-sizing:border-box;padding:6%; position:absolute;inset:0. O contêiner não deve ser animado; anime um filho #motion-camera. Para ícones importantes use data-motion-essential. Em SVG decorativo de fundo não use essa marca. Não limite a cena a max-width de site nem a uma altura diferente do formato. Antes de responder revise o enquadramento no começo, meio e fim, incluindo zoom; ajuste quebras e posições sem reduzir o conteúdo a uma faixa pequena.
EXCEÇÃO OVERLAY: o quadro permanece transparente, sem fundo opaco de tela cheia; o contêiner ocupa o formato inteiro, mas a arte fica apenas na região indicada sem cobrir o rosto.`;

export function originalConfig(p: Project): ProjectConfig {
  return p.pedidoOriginal ?? p.config;
}

export function reuseConfig(p: Project): ProjectConfig {
  return { ...originalConfig(p), nome: `${p.config.nome} (cópia)` };
}

export function buildMotionBrief(c: ProjectConfig) {
  return `Ideia: ${c.ideia}\nDuração total: ${c.duracao}s\nFormato: ${c.largura}x${c.altura}\nEstilo: ${c.estilo || "a IA decide"}\nPaleta: ${c.paleta || "a IA decide"}\nPúblico: ${c.publico || "a IA decide"}\nObjetivo: ${c.objetivo || "a IA decide"}\nIdioma dos textos: ${c.idioma}\nVelocidade: ${c.velocidade}\nIntensidade dos efeitos: ${c.intensidade}\nEfeitos sonoros: ${c.sons ? "SIM — escolha os melhores momentos" : "não"}\nMovimentos de câmera: sim, cinematográficos\nNarração por voz: ${c.voz ? "SIM — escreva o texto falado de cada cena" : "não"}`;
}

export function formatOriginalRequest(p: Project) {
  return buildMotionBrief(originalConfig(p));
}