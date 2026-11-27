import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OverlayProject } from "./overlays";

const mocks = vi.hoisted(() => ({ callAgent: vi.fn(), saveOverlay: vi.fn(), validateSceneLayout: vi.fn(), transcribe: vi.fn() }));
vi.mock("./ai", () => ({ callAgent: mocks.callAgent }));
vi.mock("./overlays", () => ({ saveOverlay: mocks.saveOverlay }));
vi.mock("./transcribe", () => ({ transcribe: mocks.transcribe }));
vi.mock("./settings", () => ({ getCreds: vi.fn(), getPrecos: vi.fn() }));
vi.mock("./costs", () => ({ logCusto: vi.fn() }));
vi.mock("./saas.functions", () => ({ reserveGeneration: vi.fn(), completeGeneration: vi.fn() }));
vi.mock("./sceneLayout", () => ({ prepareSceneHtml: (html: string) => html, validateSceneLayout: mocks.validateSceneLayout }));
import { generateOverlay, runOverlayPipeline } from "./overlayPipeline";

const project = (): OverlayProject => ({
  id: "project", nome: "Organização interna", criadoEm: 1, atualizadoEm: 1,
  video: new Blob(), largura: 1080, altura: 1920, duracao: 10, sons: true,
  transcricao: [{ inicio: 0, fim: 3, texto: "Disparo em massa" }],
  overlays: [{ id: "a", inicio: 0, fim: 3, tipo: "titulo", texto: "Disparo em massa", posicao: "inferior", modo: "texto", descricao: "Destaque", camera: "punch", html: "original" }],
  status: "pronto", log: [],
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.callAgent.mockResolvedValue({ text: "generated" });
  mocks.validateSceneLayout.mockResolvedValue([]);
});

describe("Overlay generation integration", () => {
  it("regenerates legacy highlights with the new direction and saves only after approval", async () => {
    const p = project();
    await generateOverlay(p, 0);
    const call = mocks.callAgent.mock.calls[0]?.[0] as { contexto: string } | undefined;
    const serialized = call?.contexto.split("\n").slice(3).join("\n") ?? "";
    const sent = JSON.parse(serialized) as { posicao: string; modo: string };
    expect(sent).toMatchObject({ posicao: "centro", modo: "escurecido" });
    expect(p.overlays[0]).toMatchObject({ posicao: "centro", modo: "escurecido", html: "generated" });
    expect(mocks.saveOverlay).toHaveBeenCalledTimes(1);
  });

  it("keeps an existing approved overlay unchanged if regeneration fails twice", async () => {
    mocks.validateSceneLayout.mockResolvedValue(["Texto fora do quadro"]);
    const p = project();
    await expect(generateOverlay(p, 0)).rejects.toThrow("não aprovado");
    expect(p.overlays[0]).toMatchObject({ posicao: "inferior", modo: "texto", html: "original" });
    expect(mocks.saveOverlay).not.toHaveBeenCalled();
    expect(mocks.callAgent).toHaveBeenCalledTimes(2);
  });

  it("does not regenerate saved HTML merely by resuming an already completed project", async () => {
    const p = project();
    await runOverlayPipeline(p, vi.fn());
    expect(mocks.callAgent).not.toHaveBeenCalled();
    expect(p.overlays[0]).toMatchObject({ posicao: "inferior", modo: "texto", html: "original" });
    expect(p.status).toBe("pronto");
  });

  it("passes the normalized plan through generation and saves the complete ready project", async () => {
    const p = project();
    p.overlays = [];
    const base = { tipo: "titulo", texto: "Disparo em massa", posicao: "inferior", modo: "texto", descricao: "Destaque", camera: "punch", sons: [] };
    mocks.callAgent.mockResolvedValueOnce({ text: JSON.stringify({ estilo: "Contraste", overlays: [{ ...base, inicio: 0, fim: 3 }, { ...base, inicio: 5, fim: 8 }] }) });
    await runOverlayPipeline(p, vi.fn());
    expect(p.status).toBe("pronto");
    expect(p.overlays.map((item) => ({ posicao: item.posicao, modo: item.modo, inicio: item.inicio, fim: item.fim }))).toEqual([
      { posicao: "centro", modo: "escurecido", inicio: 0, fim: 3 },
      { posicao: "centro", modo: "tela-cheia", inicio: 5, fim: 8 },
    ]);
    expect(p.overlays.every((item) => item.html === "generated")).toBe(true);
    expect(mocks.callAgent).toHaveBeenCalledTimes(3);
  });

  it("sends saved color observations to planning and every animation without the project name", async () => {
    const p = project();
    p.observacoes = "Usar verde e branco e títulos fortes.";
    p.overlays = [];
    mocks.callAgent.mockResolvedValueOnce({ text: JSON.stringify({ estilo: "Contraste", overlays: [{ inicio: 0, fim: 3, tipo: "titulo", texto: "Disparo em massa", posicao: "centro", modo: "escurecido", descricao: "Destaque", camera: "punch" }] }) });
    await runOverlayPipeline(p, vi.fn());
    expect(p.status).toBe("pronto");
    expect(mocks.callAgent).toHaveBeenCalledTimes(2);
    for (const call of mocks.callAgent.mock.calls) {
      const request = call[0] as { contexto: string };
      expect(request.contexto).toContain("Usar verde e branco e títulos fortes.");
      expect(request.contexto).not.toContain(p.nome);
    }
    expect(mocks.saveOverlay).toHaveBeenLastCalledWith(expect.objectContaining({ observacoes: "Usar verde e branco e títulos fortes." }));
  });

  it("keeps original observations in regeneration and layout repair alongside the new adjustment", async () => {
    const p = project();
    p.observacoes = "Usar verde e branco.";
    mocks.validateSceneLayout.mockResolvedValueOnce(["Texto fora do quadro"]).mockResolvedValueOnce([]);
    await generateOverlay(p, 0, "Título maior");
    expect(mocks.callAgent).toHaveBeenCalledTimes(2);
    for (const call of mocks.callAgent.mock.calls) {
      const request = call[0] as { contexto: string };
      expect(request.contexto).toContain("Usar verde e branco.");
      expect(request.contexto).toContain("Título maior");
    }
  });

  it("reports completed regeneration stages and waits for saving before 100 percent", async () => {
    const progress = vi.fn();
    let finishSave: (() => void) | undefined;
    mocks.saveOverlay.mockImplementationOnce(() => new Promise<void>((resolve) => { finishSave = resolve; }));
    const promise = generateOverlay(project(), 0, undefined, false, progress);
    await vi.waitFor(() => expect(progress).toHaveBeenLastCalledWith({ percent: 90, stage: "Salvando overlay…" }));
    expect(progress.mock.calls.map((call) => call[0].percent)).toEqual([0, 15, 65, 90]);
    if (!finishSave) throw new Error("Save not started");
    finishSave();
    await promise;
    expect(progress).toHaveBeenLastCalledWith({ percent: 100, stage: "Overlay atualizado" });
  });

  it("reports repair stages without reaching 100 when validation fails", async () => {
    const progress = vi.fn();
    mocks.validateSceneLayout.mockResolvedValue(["Texto fora do quadro"]);
    await expect(generateOverlay(project(), 0, undefined, false, progress)).rejects.toThrow("não aprovado");
    expect(progress.mock.calls.map((call) => call[0].percent)).toEqual([0, 15, 65, 75, 85]);
    expect(mocks.saveOverlay).not.toHaveBeenCalled();
  });
});