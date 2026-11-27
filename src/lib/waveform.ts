/** Peak amplitude (0..1) per bucket across all channels, for drawing waveforms. */
export function computePeaks(channels: Float32Array[], buckets: number): Float32Array {
  const length = channels[0]?.length ?? 0;
  const out = new Float32Array(Math.max(1, buckets));
  if (!length) return out;
  const size = length / out.length;
  for (let b = 0; b < out.length; b++) {
    const start = Math.floor(b * size), end = Math.min(length, Math.floor((b + 1) * size) || start + 1);
    let max = 0;
    for (const data of channels) for (let i = start; i < end; i += 4) { const v = Math.abs(data[i] ?? 0); if (v > max) max = v; }
    out[b] = Math.min(1, max);
  }
  return out;
}

export function peaksFromBuffer(buffer: AudioBuffer, buckets = 2000) {
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i));
  return computePeaks(channels, buckets);
}
