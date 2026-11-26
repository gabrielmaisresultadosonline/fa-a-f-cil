import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  storage: new Map<string, unknown>(),
  enviarJob: vi.fn(), prepararMotion: vi.fn(), prepararOverlay: vi.fn(), serverRequest: vi.fn(),
  getProject: vi.fn(), getOverlay: vi.fn(),
}));
vi.mock("idb-keyval", () => ({
  get: async (key: string) => mocks.storage.get(key),
  set: async (key: string, value: unknown) => { mocks.storage.set(key, value); },
  del: async (key: string) => { mocks.storage.delete(key); },
  keys: async () => [...mocks.storage.keys()],
}));
vi.mock("./projects", () => ({ getProject: mocks.getProject }));
vi.mock("./overlays", () => ({ getOverlay: mocks.getOverlay }));
vi.mock("./serverRender", () => ({
  enviarJob: mocks.enviarJob, prepararMotion: mocks.prepararMotion,
  prepararOverlay: mocks.prepararOverlay, serverRequest: mocks.serverRequest,
  servidorUrl: () => "http://localhost:4400",
}));
import { downloadJobUrl, enfileirar, listJobs, processarFila, retryJob, saveJob, type Job } from "./queue";

const accepted: Job = {
  id: "3d1d8643-e177-423a-901e-bab9c5d22678", nome: "Vídeo", modulo: "motion", alvoId: "project-1",
  engine: "ffmpeg", status: "renderizando", criadoEm: 1, servidor: "http://localhost:4400", remoto: true, progresso: 42,
};
beforeEach(() => {
  vi.clearAllMocks(); mocks.storage.clear();
  mocks.getProject.mockResolvedValue({ id: "project-1" });
  mocks.getOverlay.mockResolvedValue({ id: "overlay-1" });
  mocks.prepararMotion.mockResolvedValue(new FormData());
  mocks.prepararOverlay.mockResolvedValue(new FormData());
});

describe("Server-owned render queue", () => {
  it("FFmpeg submission sends inputs and stores server acceptance, without awaiting the MP4", async () => {
    mocks.enviarJob.mockImplementation(async (_fd: FormData, id: string, _server: string, progress: (value: number) => void) => {
      progress(100);
      return { id, status: "na fila", progresso: 0, etapa: "Aguardando renderização" };
    });
    const result = await enfileirar({ modulo: "motion", alvoId: "project-1", nome: "Vídeo", engine: "ffmpeg" });
    expect(result.status).toBe("na fila");
    expect(result.remoto).toBe(true);
    expect(result.envio).toBe(100);
    expect(result.resultado).toBeUndefined();
    expect(mocks.prepararMotion).toHaveBeenCalledWith({ id: "project-1" }, "ffmpeg");
  });

  it("HyperFrames overlays use the same durable server submission", async () => {
    mocks.enviarJob.mockImplementation(async (_fd: FormData, id: string) => ({ id, status: "renderizando", progresso: 5, etapa: "Quadros" }));
    const result = await enfileirar({ modulo: "overlay", alvoId: "overlay-1", nome: "Overlay", engine: "hyperframes" });
    expect(result.remoto).toBe(true);
    expect(result.engine).toBe("hyperframes");
    expect(mocks.prepararOverlay).toHaveBeenCalledWith({ id: "overlay-1" }, "hyperframes");
  });

  it("reopening reads 100% and offers the saved MP4 without resubmitting a render", async () => {
    await saveJob(accepted);
    mocks.serverRequest.mockResolvedValue({ id: accepted.id, status: "concluido", progresso: 100, etapa: "MP4 pronto", fim: 200 });
    await processarFila();
    const completed = (await listJobs())[0];
    if (!completed) throw new Error("Missing completed job");
    expect(completed.progresso).toBe(100);
    expect(downloadJobUrl(completed)).toBe(`http://localhost:4400/jobs/${accepted.id}/download`);
    expect(mocks.enviarJob).not.toHaveBeenCalled();
  });

  it("lost connection does not mark an accepted background render as failed", async () => {
    await saveJob(accepted);
    mocks.serverRequest.mockRejectedValue(new Error("Servidor indisponível"));
    await processarFila();
    const job = (await listJobs())[0];
    expect(job?.status).toBe("renderizando");
    expect(job?.progresso).toBe(42);
    expect(job?.conexao).toBe("Servidor indisponível");
  });

  it("retry uses the retained server inputs instead of uploading the project again", async () => {
    const failed: Job = { ...accepted, status: "erro", erro: "Encoder" };
    mocks.serverRequest.mockResolvedValue({ id: accepted.id, status: "na fila", progresso: 0, etapa: "Aguardando" });
    await retryJob(failed);
    expect(mocks.serverRequest).toHaveBeenCalledWith(`http://localhost:4400/jobs/${accepted.id}/retry`, { method: "POST" });
    expect(mocks.enviarJob).not.toHaveBeenCalled();
    expect((await listJobs())[0]?.status).toBe("na fila");
  });
});