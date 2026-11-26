import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { RenderQueue, validateManifest } from "./jobs.mjs";

const manifest = { nome: "Teste", engine: "ffmpeg", largura: 320, altura: 180, duracao: 1, fps: 30, overlays: [] };
async function waitFor(predicate) {
  for (let i = 0; i < 400; i++) { if (predicate()) return; await new Promise((resolve) => setTimeout(resolve, 5)); }
  throw new Error("Estado esperado não atingido");
}

test("accepted renders complete without an open browser or HTTP request and persist the MP4", async () => {
  const root = await mkdtemp(join(tmpdir(), "queue-test-"));
  try {
    const q = new RenderQueue(root, async (_, dir, update) => {
      update(42, "Quadros 12/30");
      await writeFile(join(dir, "final.mp4"), "mp4-test");
    });
    await q.init();
    const id = randomUUID();
    const accepted = await q.submit(id, manifest, async () => {});
    assert.equal(accepted.id, id);
    await waitFor(() => q.get(id)?.status === "concluido");
    assert.equal(q.get(id).progresso, 100);
    assert.equal(await readFile(join(root, id, "final.mp4"), "utf8"), "mp4-test");
    const recovered = new RenderQueue(root, () => { throw new Error("Completed job must not re-render"); });
    await recovered.init();
    assert.equal(recovered.get(id).status, "concluido");
    assert.equal(recovered.get(id).progresso, 100);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("queue bounds concurrency and submits identical IDs only once", async () => {
  const root = await mkdtemp(join(tmpdir(), "queue-test-"));
  let active = 0, max = 0, calls = 0;
  const q = new RenderQueue(root, async () => {
    calls++; active++; max = Math.max(max, active);
    await new Promise((resolve) => setTimeout(resolve, 20)); active--;
  }, 1);
  try {
    await q.init();
    const ids = [randomUUID(), randomUUID(), randomUUID()];
    for (const id of ids) await q.submit(id, manifest, async () => {});
    await q.submit(ids[0], manifest, () => { throw new Error("Duplicate input write"); });
    await waitFor(() => ids.every((id) => q.get(id)?.status === "concluido"));
    assert.equal(max, 1); assert.equal(calls, 3);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("restart resumes interrupted work and retries failures with retained input", async () => {
  const root = await mkdtemp(join(tmpdir(), "queue-test-"));
  const id = randomUUID(); let attempts = 0;
  try {
    const q = new RenderQueue(root, async (_, dir, progress) => {
      attempts++;
      assert.equal(await readFile(join(dir, "input.mp4"), "utf8"), "source");
      progress(50, "Quadros");
      if (attempts === 1) throw new Error("encoder unavailable");
      await writeFile(join(dir, "final.mp4"), "result");
    });
    await q.persist({ id, status: "renderizando", progresso: 60, criadoEm: 1, engine: "ffmpeg", nome: "Restart" });
    await writeFile(join(root, id, "manifest.json"), JSON.stringify(manifest));
    await writeFile(join(root, id, "input.mp4"), "source");
    await q.init();
    await waitFor(() => q.get(id)?.status === "erro");
    assert.equal(q.get(id).erro, "encoder unavailable");
    assert.notEqual(q.get(id).progresso, 100);
    await q.retry(id);
    await waitFor(() => q.get(id)?.status === "concluido");
    assert.equal(attempts, 2);
    await q.remove(id);
    assert.equal(q.get(id), undefined);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("rejects removal of running work and invalid paths", async () => {
  const root = await mkdtemp(join(tmpdir(), "queue-test-"));
  const q = new RenderQueue(root, async () => {});
  try {
    await q.init(); const id = randomUUID();
    await q.persist({ id, status: "renderizando", criadoEm: 1 });
    await assert.rejects(q.remove(id), /Aguarde/);
    assert.throws(() => q.directory("../../etc"), /inválido/);
    assert.throws(() => validateManifest({ ...manifest, engine: "shell" }), /Motor/);
    assert.throws(() => validateManifest({ ...manifest, overlays: [{ inicio: 0, fim: 2, html: "test" }] }), /Camada/);
  } finally { await rm(root, { recursive: true, force: true }); }
});