import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveRenderBase } from "./settings";
afterEach(() => vi.unstubAllGlobals());
describe("endereço do renderizador", () => {
  it("em HTTPS troca o endereço HTTP antigo pelo /render do domínio", () => {
    vi.stubGlobal("window", { location: { protocol: "https:", origin: "https://motionmro.com.br", hostname: "motionmro.com.br" } });
    expect(resolveRenderBase("http://189.24.24.252:4400")).toBe("https://motionmro.com.br/render");
  });
  it("em HTTP mantém o endereço configurado", () => {
    vi.stubGlobal("window", { location: { protocol: "http:", origin: "http://189.24.24.252", hostname: "189.24.24.252" } });
    expect(resolveRenderBase("http://189.24.24.252:4400/")).toBe("http://189.24.24.252:4400");
  });
});
