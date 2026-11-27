import { afterEach, describe, expect, it, vi } from "vitest";
import { webcrypto } from "node:crypto";
import { createId } from "./uuid";

afterEach(() => vi.unstubAllGlobals());

describe("UUID compatibility for HTTP/IP deployments", () => {
  it("uses the native UUID when available", () => {
    const randomUUID = vi.fn(() => "12345678-1234-4123-8123-123456789abc");
    vi.stubGlobal("crypto", { randomUUID });
    expect(createId()).toBe("12345678-1234-4123-8123-123456789abc");
    expect(randomUUID).toHaveBeenCalledOnce();
  });

  it("creates unique RFC UUID v4 identifiers without randomUUID on HTTP", () => {
    vi.stubGlobal("crypto", { getRandomValues: webcrypto.getRandomValues.bind(webcrypto) });
    const ids = Array.from({ length: 1000 }, () => createId());
    for (const id of ids) expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(new Set(ids).size).toBe(1000);
  });

  it("does not replace secure randomness with weak randomness", () => {
    vi.stubGlobal("crypto", undefined);
    expect(() => createId()).toThrow("geração segura de identificadores");
  });
});