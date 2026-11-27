import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, writeFile, chmod, rm } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { downloadYoutube, mixEditorAudio, probeDuration, rangeCovered, run, separateVocals, validYoutubeUrl } from "./audio.mjs";
import { validateManifest } from "./jobs.mjs";

const base = { nome: "Teste", engine: "ffmpeg", largura: 320, altura: 180, duracao: 4, fps: 30, overlays: [] };

test("accepts only YouTube HTTP links for music downloads", () => {
  assert.equal(validYoutubeUrl("https://www.youtube.com/watch?v=abc"), true);
  assert.equal(validYoutubeUrl("https://youtu.be/abc"), true);
  assert.equal(validYoutubeUrl("https://example.com/video"), false);
  assert.equal(validYoutubeUrl("file:///etc/passwd"), false);
});

test('YouTube adapter downloads once, converts to WAV, isolates cookies and cleans failed downloads', async () => {
  const root = await mkdtemp(join(tmpdir(), 'motion-youtube-test-'));
  const oldPath = process.env.PATH, oldCookies = process.env.YTDLP_COOKIES;
  try {
    const mediaRoot = join(root, 'media'); await mkdir(mediaRoot);
    await run('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1', join(root, 'source.wav')], root);
    const cookies = join(root, 'cookies.txt'); await writeFile(cookies, '# Netscape HTTP Cookie File\n');
    const fake = join(root, 'yt-dlp');
    await writeFile(fake, `#!/usr/bin/env node
import {appendFileSync,copyFileSync,writeFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
const args=process.argv.slice(2),root=dirname(process.argv[1]);
appendFileSync(join(root,'calls.jsonl'),JSON.stringify(args)+'\\n');
const cookie=args[args.indexOf('--cookies')+1];
writeFileSync(cookie,'temporary changed jar');
if(args.at(-1).includes('blocked')){process.stderr.write("Sign in to confirm you're not a bot. synthetic-test-marker");process.exit(1);}
copyFileSync(join(root,'source.wav'),args[args.indexOf('-o')+1].replace('%(ext)s','wav'));
console.log('Música de teste');
`);
    await chmod(fake, 0o755);
    process.env.PATH = `${root}:${oldPath || ''}`; process.env.YTDLP_COOKIES = cookies;
    const info = await downloadYoutube(mediaRoot, 'https://youtu.be/im45iuYwIZg');
    assert.equal(info.nome, 'Música de teste');
    assert.equal(info.duracao, 1);
    assert.equal(await probeDuration(join(mediaRoot, info.id, 'original.wav')), 1);
    assert.deepEqual((await readdir(join(mediaRoot, info.id))).sort(), ['download.wav', 'info.json', 'original.wav']);
    const calls = (await readFile(join(root, 'calls.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
    assert.equal(calls.length, 1);
    const args = calls[0];
    assert.equal(args[args.indexOf('--js-runtimes') + 1], `node:${process.execPath}`);
    assert.notEqual(args[args.indexOf('--cookies') + 1], cookies);
    assert.equal(await readFile(cookies, 'utf8'), '# Netscape HTTP Cookie File\n');
    await assert.rejects(downloadYoutube(mediaRoot, 'https://youtu.be/blocked'), (error) => {
      assert.match(error.message, /configurar ou renovar os cookies/);
      assert.ok(!error.message.includes('synthetic-test-marker')); return true;
    });
    assert.deepEqual(await readdir(mediaRoot), [info.id]);
  } finally {
    if (oldPath === undefined) delete process.env.PATH; else process.env.PATH = oldPath;
    if (oldCookies === undefined) delete process.env.YTDLP_COOKIES; else process.env.YTDLP_COOKIES = oldCookies;
    await rm(root, { recursive: true, force: true });
  }
});

test("validates concrete audio cuts and rejects audio beyond the source", () => {
  const audio = { video: { volume: 1, grave: 0, agudo: 0, mudo: false }, clips: [{ arquivo: "audio_0", inicio: 1, offset: 2, duracao: 3, sourceDuration: 5, volume: 1.5, grave: 6, agudo: -6 }] };
  assert.equal(validateManifest({ ...base, audio }).audio.clips[0].offset, 2);
  assert.throws(() => validateManifest({ ...base, audio: { ...audio, clips: [{ ...audio.clips[0], duracao: 3.1 }] } }), /Corte/);
  assert.throws(() => validateManifest({ ...base, audio: { ...audio, clips: [{ ...audio.clips[0], volume: 9 }] } }), /Volume/);
});

test("UVR adapter keeps original and converts the instrumental returned by audio-separator", async () => {
  const root = await mkdtemp(join(tmpdir(), "motion-uvr-test-")), id = randomUUID();
  const previous = process.env.AUDIO_SEPARATOR_COMMAND;
  try {
    const dir = join(root, id); await mkdir(dir, { recursive: true });
    await run("ffmpeg", ["-y", "-f", "lavfi", "-i", "sine=frequency=440:duration=1", "-c:a", "pcm_s16le", join(dir, "original.wav")], dir);
    await writeFile(join(dir, "info.json"), JSON.stringify({ id, nome: "Teste", duracao: 1 }));
    const original = await readFile(join(dir, "original.wav"));
    const fake = join(root, "fake-separator.mjs");
    await writeFile(fake, "#!/usr/bin/env node\nimport {copyFileSync} from 'node:fs';const out=process.argv.indexOf('--output_dir');copyFileSync(process.argv[2],process.argv[out+1]+'/teste_(Instrumental).wav');\n");
    await chmod(fake, 0o755); process.env.AUDIO_SEPARATOR_COMMAND = fake;
    const info = await separateVocals(root, id);
    assert.equal(info.instrumentalDisponivel, true);
    assert.equal(await probeDuration(join(dir, "instrumental.wav")), 1);
    assert.deepEqual(await readFile(join(dir, "original.wav")), original);
  } finally {
    if (previous === undefined) delete process.env.AUDIO_SEPARATOR_COMMAND; else process.env.AUDIO_SEPARATOR_COMMAND = previous;
    await rm(root, { recursive: true, force: true });
  }
});

test("FFmpeg mixes video, trimmed clips, delay, volume and equalization into a real WAV", async () => {
  const dir = await mkdtemp(join(tmpdir(), "motion-audio-test-"));
  try {
    const video = join(dir, "input.mp4"), clip = join(dir, "audio_0");
    await run("ffmpeg", ["-y", "-f", "lavfi", "-i", "sine=frequency=220:duration=4", "-f", "lavfi", "-i", "color=c=black:s=320x180:d=4:r=30", "-shortest", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", video], dir);
    await run("ffmpeg", ["-y", "-f", "lavfi", "-i", "sine=frequency=880:duration=5", "-c:a", "pcm_s16le", "-f", "wav", clip], dir);
    const audio = { video: { volume: 0.5, grave: 2, agudo: -2, mudo: false }, clips: [{ arquivo: "audio_0", inicio: 1, offset: 2, duracao: 2, sourceDuration: 5, volume: 0.8, grave: -3, agudo: 4 }] };
    const mixed = await mixEditorAudio({ ...base, audio }, dir, video);
    assert.ok(mixed);
    const duration = await probeDuration(mixed);
    assert.ok(Math.abs(duration - 4) < 0.05, `expected 4 seconds, received ${duration}`);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("UVR separates only the kept range and keeps the instrumental aligned to the full song", async () => {
  const root = await mkdtemp(join(tmpdir(), "motion-uvr-range-")), id = randomUUID();
  const previous = process.env.AUDIO_SEPARATOR_COMMAND;
  try {
    const dir = join(root, id); await mkdir(dir, { recursive: true });
    await run("ffmpeg", ["-y", "-f", "lavfi", "-i", "sine=frequency=440:duration=4", "-c:a", "pcm_s16le", join(dir, "original.wav")], dir);
    await writeFile(join(dir, "info.json"), JSON.stringify({ id, nome: "Teste", duracao: 4 }));
    const fake = join(root, "fake-separator.mjs");
    await writeFile(fake, "#!/usr/bin/env node\nimport {copyFileSync} from 'node:fs';const out=process.argv.indexOf('--output_dir');copyFileSync(process.argv[2],process.argv[out+1]+'/teste_(Instrumental).wav');\n");
    await chmod(fake, 0o755); process.env.AUDIO_SEPARATOR_COMMAND = fake;
    const info = await separateVocals(root, id, () => {}, { inicio: 1, fim: 2 });
    assert.deepEqual(info.faixaSemVoz, { inicio: 1, fim: 2 });
    assert.ok(Math.abs(await probeDuration(join(dir, "instrumental.wav")) - 4) < 0.05);
    assert.equal(rangeCovered(info.faixaSemVoz, { inicio: 1.2, fim: 1.8 }), true);
    assert.equal(rangeCovered(info.faixaSemVoz, { inicio: 0.5, fim: 1.8 }), false);
  } finally {
    if (previous === undefined) delete process.env.AUDIO_SEPARATOR_COMMAND; else process.env.AUDIO_SEPARATOR_COMMAND = previous;
    await rm(root, { recursive: true, force: true });
  }
});
