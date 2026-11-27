import type { Project, ProjectConfig } from "./projects";

export const CREATION_RULES = `O nome do projeto é apenas organização externa: nunca inclua o nome do projeto como texto, marca, título ou narração no vídeo. Use somente o conteúdo solicitado na ideia ou na fala original.
QUALIDADE OBRIGATÓRIA EM TODOS OS MODELOS, INCLUSIVE MINI/NANO: componha especificamente para WIDTH x HEIGHT, não copie um layout horizontal para vídeo vertical. O fundo preenche 100% do quadro, sem moldura, barras internas, cartão central pequeno ou espaço morto sem intenção. Distribua hierarquia, elementos visuais e textos por todo o formato, mantendo área segura de 6% nas bordas. Textos legíveis, sem cortes e sem sobreposição entre blocos. Não use nowrap, ellipsis, line-clamp ou overflow:hidden para esconder texto. Use grid/flex com min-width:0, quebras de linha e fonte adequada ao espaço. Conteúdo principal deve continuar dentro do quadro durante os movimentos de câmera; reserve espaço para o zoom e parallax.
ACABAMENTO: crie ícones SVG inline com viewBox, ilustrações vetoriais próprias, gráficos ou objetos visuais pertinentes ao assunto, não apenas texto e partículas genéricas. Imagens só autocontidas (data URI) quando disponíveis; nunca invente URLs ou deixe recursos quebrados. Não é necessário comprar imagens nem usar outro modelo. Ajuste a quantidade de conteúdo à duração; poucos elementos bem desenhados são melhores que muitos blocos apertados.
CONTRATO HTML: fundo decorativo em camada separada, position:absolute;inset:0. Todo texto/ícone/ilustração essencial dentro de #motion-content, width:WIDTHpx;height:HEIGHTpx;box-sizing:border-box;padding:6%; position:absolute;inset:0. O contêiner não deve ser animado; anime um filho #motion-camera. Para ícones importantes use data-motion-essential. Em SVG decorativo de fundo não use essa marca. Não limite a cena a max-width de site nem a uma altura diferente do formato. Antes de responder revise o enquadramento no começo, meio e fim, incluindo zoom; ajuste quebras e posições sem reduzir o conteúdo a uma faixa pequena.
REGRA ABSOLUTA — MOVIMENTO DE CÂMERA: a câmera NUNCA fica parada. Todos os segundos têm movimento visível e intencional: dolly zoom, slow shutter (rastros/motion blur), parallax 3D entre camadas, push in, pull out, orbit, whip pan, tilt/roll, zoom impact sincronizado com o áudio e tracking dos elementos. Movimentos perceptíveis, fluidos, fortes e dinâmicos; nunca excessivamente lentos.
REGRA ABSOLUTA — PARALLAX E FUNDO: o fundo preenche 100% da tela em TODO instante, inclusive durante zooms, rotações e parallax. Use overscan (fundo maior que o quadro, com margem de segurança para todos os movimentos), camadas independentes em profundidades/velocidades diferentes, e compense posição/escala das camadas durante a câmera. Nunca bordas transparentes, áreas pretas não intencionais, fundo fora de esquadro ou fundo que diminui/deforma.
EFEITOS VISUAIS CONSTANTES, acompanhando a câmera (não estáticos sobre o vídeo): reflexos metálicos e holográficos, flashes amarelos/brancos, partículas 3D, linhas luminosas e rastros de luz, motion blur cinematográfico, profundidade de campo, explosões sutis de partículas, elementos tecnológicos flutuantes, iluminação volumétrica, transições whip pan e zooms rápidos com impacto.
EXCEÇÃO OVERLAY: alterne impacto total e vídeo visível — momentos com FUNDO SÓLIDO OPACO cobrindo todo o quadro (só texto/arte em cima) e momentos de véu escurecido deixando o vídeo reaparecer; nunca deixe só arte pequena sobre o vídeo sem presença. O contêiner ocupa o formato inteiro.`;

export function originalConfig(p: Project): ProjectConfig {
  return p.pedidoOriginal ?? p.config;
}

export function reuseConfig(p: Project): ProjectConfig {
  return { ...originalConfig(p), nome: `${p.config.nome} (cópia)` };
}

export function buildMotionBrief(c: ProjectConfig) {
  return `Ideia: ${c.ideia}\nDuração total: ${c.duracao}s\nFormato: ${c.largura}x${c.altura}\nEstilo: ${c.estilo || "a IA decide"}\nPaleta: ${c.paleta || "a IA decide"}\nPúblico: ${c.publico || "a IA decide"}\nObjetivo: ${c.objetivo || "a IA decide"}\nIdioma dos textos: ${c.idioma}\nVelocidade: ${c.velocidade}\nIntensidade dos efeitos: ${c.intensidade}\nEfeitos sonoros: ${c.sons ? "SIM — escolha os melhores momentos" : "não"}\nMovimentos de câmera: sim, cinematográficos\nNarração por voz: não; áudio será editado depois em camadas`;
}

export function formatOriginalRequest(p: Project) {
  return buildMotionBrief(originalConfig(p));
}