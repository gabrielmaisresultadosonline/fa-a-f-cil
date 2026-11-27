import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeCookies, safeLines } from './test-youtube.mjs';

test('reports missing login cookies by name only', () => {
  const text = ['# Netscape HTTP Cookie File', '.youtube.com\tTRUE\t/\tTRUE\t0\tPREF\tsecretvalue'].join('\n');
  const info = describeCookies(text);
  assert.equal(info.total, 1);
  assert.ok(info.missingLogin.includes('LOGIN_INFO'));
});

test('diagnostic output hides cookie and token values', () => {
  const lines = safeLines('[debug] something\nWARNING: po_token=abc123 visitor_data=xyz\nERROR: Sign in to confirm');
  assert.equal(lines.length, 2);
  assert.doesNotMatch(lines.join('\n'), /abc123|xyz/);
});
