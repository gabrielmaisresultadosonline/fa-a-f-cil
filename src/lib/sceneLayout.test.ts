import { describe, expect, it } from "vitest";
import { prepareSceneHtml } from "./sceneLayout";

describe("Model-independent scene framing", () => {
  it.each([[1080,1920],[1080,1350],[1080,1080],[1920,1080],[2560,1440],[3840,2160]])("preserves the chosen %ix%i canvas", (w,h) => {
    const html=prepareSceneHtml('<html><body><h1>Oferta</h1></body></html>',w,h);
    expect(html).toContain(`const W=${w}, H=${h}`);
  });
  it("does not stack layout correction when a saved scene is reopened", () => {
    const html=prepareSceneHtml('<html><body>Oferta</body></html>',1080,1920);
    expect(prepareSceneHtml(html,1080,1920)).toBe(html);
  });
  it("rejects an invalid format rather than silently clipping it", () => {
    expect(()=>prepareSceneHtml('<html></html>',0,1920)).toThrow("Formato de vídeo inválido.");
  });
});