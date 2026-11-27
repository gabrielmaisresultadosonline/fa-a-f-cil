import { test } from 'node:test';
import assert from 'node:assert/strict';
import { youtubeArguments, youtubeError } from './youtube.mjs';

test('YouTube explicitly uses the current Node executable with local EJS', () => {
  const args = youtubeArguments('/tmp/download.%(ext)s', 'https://youtu.be/im45iuYwIZg');
  assert.equal(args[args.indexOf('--js-runtimes') + 1], `node:${process.execPath}`);
  assert.ok(args.includes('--ignore-config'));
  assert.ok(!args.includes('--remote-components'));
});

test('title is printed after downloading, not obtained through a second simulated extraction', () => {
  const args = youtubeArguments('/tmp/download.%(ext)s', 'https://youtu.be/im45iuYwIZg', '/tmp/private-cookie-jar');
  assert.equal(args[args.indexOf('--print') + 1], 'after_move:%(title)s');
  assert.ok(args.includes('--no-simulate'));
  assert.equal(args[args.indexOf('--cookies') + 1], '/tmp/private-cookie-jar');
  assert.equal(args.at(-2), '--');
});

test('download preserves the 300 MB and single-video limits', () => {
  const args = youtubeArguments('/tmp/download.%(ext)s', 'https://youtu.be/im45iuYwIZg');
  assert.equal(args[args.indexOf('--max-filesize') + 1], '300M');
  assert.ok(args.includes('--no-playlist'));
});

test('bot confirmation takes priority over the accompanying JS runtime warning', () => {
  const message = youtubeError(new Error("No supported JavaScript runtime could be found. Sign in to confirm you’re not a bot. cookie=synthetic-test-marker")).message;
  assert.match(message, /configurar ou renovar os cookies/);
  assert.ok(!message.includes('synthetic-test-marker'));
});

test('unknown extractor errors do not expose diagnostics', () => {
  const message = youtubeError(new Error('unknown failure session=synthetic-test-marker')).message;
  assert.ok(!message.includes('synthetic-test-marker'));
  assert.match(message, /arquivo de áudio autorizado/);
});