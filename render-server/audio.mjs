import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { copyFile, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

export const validMediaId = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);

export function run(cmd, args, cwd, onOutput) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, windowsHide: true });
    let err = "", out = "";
    child.stderr.on("data", (d) => { err += d; if (err.length > 30000) err = err.slice(-30000); });
    child.stdout.on("data", (d) => { out += d; if (onOutput) onOutput(String(d)); else process.stdout.write(d); });
    child.on("error", (e) => reject(new Error(`${cmd} não está instalado ou não pôde ser iniciado: ${e.message}`)));
    child.on("close", (code) => code === 0 ? resolve(out) : reject(new Error(`${cmd} saiu com código ${code}\n${err.slice(-3000)}`)));
  });
}

export function probeDuration(file) {
  return new Promise((resolve, reject) => {
    const child = spawn("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", file], { windowsHide: true });
    let out = "", err = "";
    child.stdout.on("data", (d) => { out += d; });
    child.stderr.on("data", (d) => { err += d; });
    child.on("error", reject);
    child.on("close", (code) => {
      const duration = Number(out.trim());
      if (code === 0 && Number.isFinite(duration) && duration > 0) resolve(duration);
      else reject(new Error(`Não foi possível ler a duração: ${err.slice(-500)}`));
    });
  });
}

export function hasAudio(file) {
  return new Promise((resolve) => {
    const child = spawn("ffprobe", ["-v", "error", "-select_streams", "a", "-show_entries", "stream=index", "-of", "csv=p=0", file], { windowsHide: true });
    let out = ""; child.stdout.on("data", (d) => { out += d; });
    child.on("error", () => resolve(false)); child.on("close", () => resolve(out.trim().length > 0));
  });
}

export function validYoutubeUrl(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    return ["http:", "https:"].includes(url.protocol) && ["youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be"].includes(host);
  } catch { return false; }
}

export function mediaDirectory(root, id) {
  if (!validMediaId(id)) throw new Error("Identificador de mídia inválido");
  return join(root, id);
}

export async function mediaInfo(root, id) {
  return JSON.parse(await readFile(join(mediaDirectory(root, id), "info.json"), "utf8"));
}

export async function downloadYoutube(root, value) {
  if (!validYoutubeUrl(value)) throw new Error("Cole um link válido de um vídeo do YouTube");
  const id = randomUUID(), dir = mediaDirectory(root, id);
  await mkdir(dir, { recursive: true });
  const output = join(dir, "download.%(ext)s");
  const args = ["--no-playlist", "--max-filesize", "300M", "--restrict-filenames", "--print", "title", "-f", "bestaudio/best", "-o", output];
  if (process.env.YTDLP_COOKIES) args.push("--cookies", process.env.YTDLP_COOKIES);
  args.push(value);
  const stdout = await run("yt-dlp", args, dir);
  const downloaded = (await readdir(dir)).find((name) => name.startsWith("download.") && !name.endsWith(".part"));
  if (!downloaded) throw new Error("O yt-dlp terminou sem gerar um arquivo de áudio");
  const original = join(dir, "original.wav");
  await run("ffmpeg", ["-y", "-i", join(dir, downloaded), "-vn", "-ac", "2", "-ar", "48000", "-c:a", "pcm_s16le", original], dir);
  const duracao = await probeDuration(original);
  const lines = stdout.trim().split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  const info = { id, nome: lines.at(-1)?.slice(0, 180) || "Música do YouTube", duracao, criadoEm: Date.now(), origem: value, instrumentalDisponivel: false };
  await writeFile(join(dir, "info.json"), JSON.stringify(info));
  return info;
}

export async function separateVocals(root, id) {
  const dir = mediaDirectory(root, id), info = await mediaInfo(root, id);
  const instrumental = join(dir, "instrumental.wav");
  if (await stat(instrumental).then(() => true, () => false)) return { ...info, instrumentalDisponivel: true };
  const separated = join(dir, "separated"); await mkdir(separated, { recursive: true });
  const command = process.env.AUDIO_SEPARATOR_COMMAND || "audio-separator";
  const model = process.env.UVR_MODEL || "UVR-MDX-NET-Inst_HQ_4.onnx";
  await run(command, [join(dir, "original.wav"), "--model_filename", model, "--output_dir", separated, "--output_format=WAV"], dir);
  const names = await readdir(separated);
  const source = names.find((name) => /instrumental|accompaniment|other/i.test(name) && /\.(wav|mp3|flac|ogg)$/i.test(name));
  if (!source) throw new Error(`O UVR não gerou a faixa instrumental. Arquivos recebidos: ${names.join(", ").slice(0, 300)}`);
  await run("ffmpeg", ["-y", "-i", join(separated, source), "-ac", "2", "-ar", "48000", "-c:a", "pcm_s16le", instrumental], dir);
  const next = { ...info, instrumentalDisponivel: true, modeloUvr: model };
  await writeFile(join(dir, "info.json"), JSON.stringify(next));
  return next;
}

export function streamMediaAudio(root, id, stem) {
  if (!['original', 'instrumental'].includes(stem)) throw new Error("Faixa de áudio inválida");
  const file = join(mediaDirectory(root, id), stem === "instrumental" ? "instrumental.wav" : "original.wav");
  return { file, stream: createReadStream(file) };
}

export async function copyMediaIntoJob(root, id, stem, destination) {
  const file = join(mediaDirectory(root, id), stem === "instrumental" ? "instrumental.wav" : "original.wav");
  await copyFile(file, destination);
}

/** Mixa vídeo e clipes em um WAV único; assim FFmpeg e HyperFrames usam exatamente a mesma edição. */
export async function mixEditorAudio(m, dir, video) {
  if (!m.audio) return null;
  const clips = m.audio.clips ?? [], videoSettings = m.audio.video ?? { volume: 1, grave: 0, agudo: 0, mudo: false };
  const args = ["-y"], filters = [], labels = [];
  const videoHasAudio = await hasAudio(video);
  if (videoHasAudio && !videoSettings.mudo && videoSettings.volume > 0) {
    const index = labels.length; args.push("-i", video);
    filters.push(`[${index}:a]atrim=0:${m.duracao},asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo,volume=${videoSettings.volume},bass=g=${videoSettings.grave},treble=g=${videoSettings.agudo}[a${index}]`);
    labels.push(`[a${index}]`);
  }
  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i];
    if (clip.volume <= 0) continue;
    const index = labels.length;
    args.push("-i", join(dir, clip.arquivo));
    const delay = Math.round(clip.inicio * 1000);
    filters.push(`[${index}:a]atrim=start=${clip.offset}:duration=${clip.duracao},asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo,volume=${clip.volume},bass=g=${clip.grave},treble=g=${clip.agudo},adelay=${delay}:all=1[a${index}]`);
    labels.push(`[a${index}]`);
  }
  if (!labels.length) return null;
  const mix = join(dir, "mix.wav");
  filters.push(`${labels.join("")}amix=inputs=${labels.length}:duration=longest:dropout_transition=0:normalize=0,atrim=0:${m.duracao},alimiter=limit=0.95[aout]`);
  args.push("-filter_complex_threads", "1", "-filter_complex", filters.join(";"), "-map", "[aout]", "-t", String(m.duracao), "-ar", "48000", "-ac", "2", "-c:a", "pcm_s16le", mix);
  await run("ffmpeg", args, dir);
  return mix;
}
