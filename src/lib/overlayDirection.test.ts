import { describe, expect, it } from "vitest";
import { centerOverlay, directOverlayPlan } from "./overlayDirection";
import type { Overlay } from "./overlays";

const overlay = (id: string, inicio: number, modo: Overlay["modo"] = "texto"): Overlay => ({
  id, inicio, fim: inicio + 3, tipo: "titulo", texto: "Disparo em massa",
  posicao: "inferior", modo: modo ?? "texto", descricao: "Destaque da fala", camera: "punch",
  sons: [{ t: 0, tipo: "impacto" }],
});

describe("Overlay composition direction", () => {
  it("replaces corner-only plans with centered dimming and solid full-frame moments", () => {
    const result = directOverlayPlan([overlay("a", 0), overlay("b", 5), overlay("c", 10)]);
    expect(result.map((item) => item.posicao)).toEqual(["centro", "centro", "centro"]);
    expect(result.map((item) => item.modo)).toEqual(["escurecido", "tela-cheia", "escurecido"]);
  });

  it("darkens the background even for a single highlight instead of retaining transparent text", () => {
    expect(directOverlayPlan([overlay("a", 0)])[0]?.modo).toBe("escurecido");
  });

  it("keeps the AI's chosen mode sequence when it already varies dimming and full-screen moments", () => {
    const result = directOverlayPlan([overlay("a", 0, "tela-cheia"), overlay("b", 5, "escurecido")]);
    expect(result.map((item) => item.modo)).toEqual(["tela-cheia", "escurecido"]);
  });

  it("preserves timing, transcript text, camera and sound effects when upgrading a composition", () => {
    const source = overlay("a", 5);
    const result = centerOverlay(source);
    expect(result).toMatchObject({ id: "a", inicio: 5, fim: 8, texto: "Disparo em massa", camera: "punch", sons: [{ t: 0, tipo: "impacto" }] });
    expect(source.posicao).toBe("inferior");
    expect(source.modo).toBe("texto");
  });

  it("alternates back to the visible darkened video when every planned moment is full-screen", () => {
    const result = directOverlayPlan([overlay("a", 0, "tela-cheia"), overlay("b", 5, "tela-cheia")]);
    expect(result.map((item) => item.modo)).toEqual(["escurecido", "tela-cheia"]);
  });
});