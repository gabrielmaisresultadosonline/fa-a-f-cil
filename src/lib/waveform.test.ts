import { describe, expect, it } from "vitest";
import { computePeaks } from "./waveform";

describe("computePeaks", () => {
  it("returns the loudest sample of each bucket across channels", () => {
    const left = new Float32Array([0, 0, 0, 0, 0.5, 0, 0, 0]);
    const right = new Float32Array([0, 0, 0, 0, 0, 0, 0, 0]);
    right[0] = -0.8;
    const peaks = computePeaks([left, right], 2);
    expect(peaks[0]).toBeCloseTo(0.8);
    expect(peaks[1]).toBeCloseTo(0.5);
  });
});
