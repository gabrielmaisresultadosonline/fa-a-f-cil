import type { Project, ProjectConfig } from "./projects";

export const CREATION_RULES = "O nome do projeto é apenas organização externa: nunca inclua o nome do projeto como texto, marca, título ou narração no vídeo. Use somente o conteúdo solicitado na ideia ou na fala original. Adapte o layout ao formato solicitado, mantenha textos e elementos dentro do quadro, sem cortes nem sobreposições; use medidas proporcionais e quebras de linha para manter a legibilidade.";

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