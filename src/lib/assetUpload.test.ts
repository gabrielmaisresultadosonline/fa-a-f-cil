import { afterEach, describe, expect, it, vi } from "vitest";
import { uploadSignedBlob } from "./assetUpload";

class UploadRequest {
  static latest: UploadRequest | undefined;
  upload = { onprogress: null as ((e: { lengthComputable: boolean; loaded: number; total: number }) => void) | null };
  status = 200;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  onload: (() => void) | null = null;
  open = vi.fn();
  setRequestHeader = vi.fn();
  send = vi.fn();
  constructor() { UploadRequest.latest = this; }
}
afterEach(() => { vi.unstubAllGlobals(); });

describe("private video upload", () => {
  it("reports actual bytes and waits for storage confirmation", async () => {
    vi.stubGlobal("XMLHttpRequest", UploadRequest);
    const progress = vi.fn();
    const finished = vi.fn();
    const promise = uploadSignedBlob("https://storage.example/signed", new Blob(["video"]), progress).then(finished);
    const xhr = UploadRequest.latest;
    if (!xhr) throw new Error("Missing upload request");
    expect(xhr.open).toHaveBeenCalledWith("PUT", "https://storage.example/signed");
    expect(xhr.send.mock.calls[0]?.[0]).toBeInstanceOf(FormData);
    xhr.upload.onprogress?.({ lengthComputable: true, loaded: 37, total: 100 });
    expect(progress).toHaveBeenLastCalledWith(37);
    xhr.upload.onprogress?.({ lengthComputable: false, loaded: 50, total: 0 });
    expect(progress).toHaveBeenLastCalledWith(37);
    xhr.upload.onprogress?.({ lengthComputable: true, loaded: 100, total: 100 });
    await Promise.resolve();
    expect(finished).not.toHaveBeenCalled();
    xhr.onload?.();
    await promise;
    expect(progress).toHaveBeenLastCalledWith(100);
    expect(finished).toHaveBeenCalledOnce();
  });

  it.each(["network", "storage", "abort"])("rejects %s failures without reporting success", async (failure) => {
    vi.stubGlobal("XMLHttpRequest", UploadRequest);
    const progress = vi.fn();
    const promise = uploadSignedBlob("https://storage.example/signed", new Blob(), progress);
    const assertion = expect(promise).rejects.toThrow();
    const xhr = UploadRequest.latest;
    if (!xhr) throw new Error("Missing upload request");
    if (failure === "network") xhr.onerror?.();
    else if (failure === "abort") xhr.onabort?.();
    else { xhr.status = 400; xhr.onload?.(); }
    await assertion;
    expect(progress).not.toHaveBeenCalledWith(100);
  });
});