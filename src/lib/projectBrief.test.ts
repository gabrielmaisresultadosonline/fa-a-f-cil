import { describe, expect, it } from "vitest";
import type { Project, ProjectConfig } from "./projects";
import { buildMotionBrief, originalConfig, reuseConfig } from "./projectBrief";

const config: ProjectConfig = { nome: "Nome interno confidencial", ideia: "Crie um vídeo sobre café.\nTermine com: Experimente hoje!", duracao: 30, largura: 1080, altura: 1920, estilo: "Tipografia cinética", paleta: "Verde e branco", publico: "Clientes", objetivo: "Venda", idioma: "Português", velocidade: "Média", intensidade: "Alta", sons: true, voz: false };
const project: Project = { id: "original", criadoEm: 1, atualizadoEm: 1, config, cenas: [], agentes: {}, log: [], status: "rascunho" };

describe("Original project request", () => {
  it("keeps the entire typed command including line breaks", () => {
    expect(originalConfig(project).ideia).toBe("Crie um vídeo sobre café.\nTermine com: Experimente hoje!");
  });
  it("retains the original request after project settings change", () => {
    const edited = { ...project, pedidoOriginal: { ...config }, config: { ...config, ideia: "Alterado", sons: false } };
    expect(originalConfig(edited).ideia).toBe(config.ideia);
    expect(originalConfig(edited).sons).toBe(true);
  });
  it("reuses all original settings without mutating the source", () => {
    const copy = reuseConfig(project);
    expect(copy).toEqual({ ...config, nome: "Nome interno confidencial (cópia)" });
    copy.ideia = "Outra ideia";
    expect(project.config.ideia).toBe(config.ideia);
  });
  it("never sends the organizational project name to motion generation", () => {
    expect(buildMotionBrief(config)).not.toContain("Nome interno confidencial");
    expect(buildMotionBrief(config)).toContain(config.ideia);
  });
});