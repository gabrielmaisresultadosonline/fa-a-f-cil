import { describe, expect, it } from "vitest";
import { addClip, clipMix, deleteClip, moveClipTo, splitClip, trimClipTo, updateClip, updateTrack, type EditorProject } from "./editor";

function project(): EditorProject {
  return { id: "editor", modulo: "motion", alvoId: "video", nome: "Teste", largura: 1920, altura: 1080, duracao: 20, criadoEm: 1, atualizadoEm: 1,
    tracks: [{ id: "video", tipo: "video", nome: "Vídeo principal", volume: 1, grave: 0, agudo: 0, mudo: false, clips: [] }] };
}
function withClip() {
  const next = addClip(project(), { nome: "Música", sourceDuration: 30, inicio: 2, tipo: "musica", novaFaixa: true });
  const clip = next.tracks[1]!.clips[0]!;
  return { next, clip };
}

describe("Non-destructive layer editing", () => {
  it("limits a 30 second clip to the remaining 18 seconds of a 20 second video", () => {
    const { clip } = withClip();
    expect(clip.inicio).toBe(2);
    expect(clip.duracao).toBe(18);
    expect(clip.offset).toBe(0);
  });

  it("moves a clip without allowing it to leave the video", () => {
    const { next, clip } = withClip();
    const moved = moveClipTo(next, clip.id, 19);
    expect(moved.tracks[1]!.clips[0]!.inicio).toBe(2);
    const beforeStart = moveClipTo(next, clip.id, -8);
    expect(beforeStart.tracks[1]!.clips[0]!.inicio).toBe(0);
  });

  it("trims the left edge by advancing source offset and preserving the right edge", () => {
    const { next, clip } = withClip();
    const trimmed = trimClipTo(next, clip.id, "inicio", 5).tracks[1]!.clips[0]!;
    expect(trimmed.inicio).toBe(5);
    expect(trimmed.offset).toBe(3);
    expect(trimmed.duracao).toBe(15);
    expect(trimmed.inicio + trimmed.duracao).toBe(20);
  });

  it("splits at 8 seconds into independent clips with continuous source offsets", () => {
    const { next, clip } = withClip();
    const clips = splitClip(next, clip.id, 8).tracks[1]!.clips;
    expect(clips).toHaveLength(2);
    expect(clips[0]!.duracao).toBe(6);
    expect(clips[1]!.inicio).toBe(8);
    expect(clips[1]!.offset).toBe(6);
    expect(clips[1]!.duracao).toBe(12);
    expect(clips[1]!.assetId).toBe(clip.assetId);
  });

  it("does not split on an edge and deletes only the selected clip", () => {
    const { next, clip } = withClip();
    expect(splitClip(next, clip.id, 2)).toEqual(next);
    expect(deleteClip(next, clip.id).tracks[1]!.clips).toHaveLength(0);
  });

  it("combines clip and track volume and equalization within render limits", () => {
    const { next, clip } = withClip();
    const track = next.tracks[1]!;
    let edited = updateClip(next, clip.id, { volume: 1.5, grave: 8, agudo: -4 });
    edited = updateTrack(edited, track.id, { volume: 1.5, grave: 10, agudo: -10 });
    const result = clipMix(edited.tracks[1]!.clips[0]!, edited.tracks[1]!);
    expect(result).toEqual({ volume: 2.25, grave: 18, agudo: -14 });
  });
});
