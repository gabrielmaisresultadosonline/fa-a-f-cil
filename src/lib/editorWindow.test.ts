import { describe, expect, it } from "vitest";
import { setClipWindow, vocalsRemovedFor, type EditorClip, type EditorProject } from "./editor";

const base: EditorClip = { id: "c", assetId: "x", nome: "m", inicio: 0, offset: 0, duracao: 30, sourceDuration: 120, volume: 1, grave: 0, agudo: 0 };
const first = (p: EditorProject) => p.tracks[0]!.clips[0]!;

const project = (): EditorProject => ({ id: "p", modulo: "motion", alvoId: "a", nome: "n", largura: 1, altura: 1, duracao: 30, criadoEm: 0, atualizadoEm: 0,
  tracks: [{ id: "t", tipo: "musica", nome: "Música", volume: 1, grave: 0, agudo: 0, mudo: false, clips: [{ ...base }] }] });

describe("setClipWindow", () => {
  it("lets a 30 s video use any part of a 2 min song, never longer than the video", () => {
    const clip = first(setClipWindow(project(), "c", 75, 60));
    expect(clip.offset).toBe(75);
    expect(clip.duracao).toBe(30);
  });
  it("stops at the end of the song", () => {
    const clip = first(setClipWindow(project(), "c", 110, 30));
    expect(clip.duracao).toBe(10);
  });
});

describe("vocalsRemovedFor", () => {
  it("is false when the kept part moves outside the separated range", () => {
    const clip: EditorClip = { ...base, stem: "instrumental" as const, faixaSemVoz: { inicio: 60, fim: 90 } };
    expect(vocalsRemovedFor({ ...clip, offset: 60, duracao: 30 })).toBe(true);
    expect(vocalsRemovedFor({ ...clip, offset: 20, duracao: 30 })).toBe(false);
  });
});
