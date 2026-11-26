const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Grava a área do elemento na aba atual (Chrome/Edge) e devolve o arquivo de vídeo. */
export async function recordRegion(el: HTMLElement, seconds: number, audio: MediaStream | null, onStart: () => void | Promise<void>) {
  const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: false, preferCurrentTab: true, selfBrowserSurface: "include" } as DisplayMediaStreamOptions);
  const track = stream.getVideoTracks()[0]!;
  const CT = (window as unknown as { CropTarget?: { fromElement(e: Element): Promise<unknown> } }).CropTarget;
  const crop = (track as unknown as { cropTo?: (t: unknown) => Promise<void> }).cropTo;
  if (CT && crop) await crop.call(track, await CT.fromElement(el));
  const ms = new MediaStream([track, ...(audio?.getAudioTracks() ?? [])]);
  const mime = ["video/mp4;codecs=avc1,mp4a.40.2", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm"].find((m) => MediaRecorder.isTypeSupported(m)) ?? "video/webm";
  const mr = new MediaRecorder(ms, { mimeType: mime, videoBitsPerSecond: 12_000_000 });
  const chunks: Blob[] = [];
  mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise<void>((r) => (mr.onstop = () => r()));
  await sleep(700);
  mr.start(250);
  await onStart();
  await sleep(seconds * 1000 + 400);
  mr.stop(); await done;
  stream.getTracks().forEach((t) => t.stop());
  const type = mime.split(";")[0]!;
  return { blob: new Blob(chunks, { type }), ext: type.includes("mp4") ? "mp4" : "webm" };
}
export function download(blob: Blob, name: string) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click();
}
