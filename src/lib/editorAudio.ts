import { clipMix, clipUrl, type EditorClip, type EditorProject } from "./editor";
import { renderFetch } from "./renderAuth";

interface ActiveClip {
  source: AudioBufferSourceNode;
  gain: GainNode;
  grave: BiquadFilterNode;
  agudo: BiquadFilterNode;
}

/** Prévia precisa: cada clipe usa o mesmo corte, volume e equalização do render. */
export class EditorAudioEngine {
  private context?: AudioContext;
  private buffers = new Map<string, Promise<AudioBuffer>>();
  private active = new Map<string, ActiveClip>();
  private generation = 0;

  private ctx() {
    if (!this.context) this.context = new AudioContext();
    if (this.context.state === "suspended") void this.context.resume();
    return this.context;
  }

  private load(clip: EditorClip) {
    const cached = this.buffers.get(clip.assetId);
    if (cached) return cached;
    const promise = (async () => {
      const data = clip.blob ? await clip.blob.arrayBuffer() : await (async () => {
        const url = clipUrl(clip);
        if (!url) throw new Error(`Áudio indisponível: ${clip.nome}`);
        const response = await renderFetch(url);
        if (!response.ok) throw new Error(`Não foi possível carregar ${clip.nome}`);
        return response.arrayBuffer();
      })();
      return this.ctx().decodeAudioData(data.slice(0));
    })();
    this.buffers.set(clip.assetId, promise);
    promise.catch(() => this.buffers.delete(clip.assetId));
    return promise;
  }

  /** Decoded audio for waveforms and the trimmer preview (shares the playback cache). */
  loadBuffer(clip: EditorClip) { return this.load(clip); }

  private sourcePreview: AudioBufferSourceNode | undefined;
  /** Plays the raw source (whole song) from `from` seconds, ignoring the timeline. */
  async playSource(clip: EditorClip, from: number, onEnd: () => void) {
    this.stopSource();
    const buffer = await this.load(clip); const ctx = this.ctx();
    const source = ctx.createBufferSource(); source.buffer = buffer; source.connect(ctx.destination);
    source.onended = () => { if (this.sourcePreview === source) { this.sourcePreview = undefined; onEnd(); } };
    source.start(0, Math.max(0, Math.min(buffer.duration, from)));
    this.sourcePreview = source;
    return ctx.currentTime;
  }
  stopSource() { const s = this.sourcePreview; this.sourcePreview = undefined; try { s?.stop(); } catch { /* already stopped */ } }
  now() { return this.ctx().currentTime; }

  async play(project: EditorProject, time: number) {
    this.stop();
    const generation = this.generation;
    const clips = project.tracks.flatMap((track) => track.mudo ? [] : track.clips
      .filter((clip) => clip.inicio + clip.duracao > time && clip.inicio < project.duracao)
      .map((clip) => ({ clip, track })));
    const loaded = await Promise.all(clips.map(async (x) => ({ ...x, buffer: await this.load(x.clip) })));
    if (generation !== this.generation) return;
    const ctx = this.ctx();
    for (const { clip, track, buffer } of loaded) {
      const elapsed = Math.max(0, time - clip.inicio);
      const delay = Math.max(0, clip.inicio - time);
      const remaining = clip.duracao - elapsed;
      if (remaining <= 0) continue;
      const source = ctx.createBufferSource();
      const grave = ctx.createBiquadFilter(); grave.type = "lowshelf"; grave.frequency.value = 180;
      const agudo = ctx.createBiquadFilter(); agudo.type = "highshelf"; agudo.frequency.value = 3200;
      const gain = ctx.createGain();
      source.buffer = buffer;
      source.connect(grave).connect(agudo).connect(gain).connect(ctx.destination);
      this.active.set(clip.id, { source, gain, grave, agudo });
      this.applyClip(clip, track);
      source.start(ctx.currentTime + delay, clip.offset + elapsed, remaining);
    }
  }

  private applyClip(clip: EditorClip, track: EditorProject["tracks"][number]) {
    const node = this.active.get(clip.id);
    if (!node) return;
    const mix = clipMix(clip, track);
    node.gain.gain.value = mix.volume;
    node.grave.gain.value = mix.grave;
    node.agudo.gain.value = mix.agudo;
  }

  update(project: EditorProject) {
    for (const track of project.tracks) for (const clip of track.clips) this.applyClip(clip, track);
    for (const [id, node] of this.active) {
      const track = project.tracks.find((t) => t.clips.some((c) => c.id === id));
      if (!track || track.mudo) { try { node.source.stop(); } catch { /* already stopped */ } this.active.delete(id); }
    }
  }

  reset() {
    this.stop();
    this.buffers.clear();
  }

  stop() {
    this.generation++;
    for (const node of this.active.values()) {
      try { node.source.stop(); } catch { /* already stopped */ }
      node.source.disconnect(); node.gain.disconnect(); node.grave.disconnect(); node.agudo.disconnect();
    }
    this.active.clear();
  }
}
