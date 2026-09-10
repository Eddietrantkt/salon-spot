import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { fallbackImageFor } from '../src/shared/ui/media-fallbacks.ts';

const designTokens = await readFile(new URL('../src/shared/design-tokens.css', import.meta.url), 'utf8');

test('uses stable online imagery when marketplace media is missing or unavailable', () => {
  assert.match(fallbackImageFor('Ghế tạo mẫu No. 01'), /^https:\/\/images\.unsplash\.com\//);
  assert.notEqual(fallbackImageFor('Private Styling Studio'), fallbackImageFor('Ghế tạo mẫu No. 01'));
});

test('does not force the sign-in surface to create a viewport-sized scroll frame', () => {
  assert.match(designTokens, /\.auth-shell\s*\{[^}]*padding-top:\s*28px[^}]*padding-bottom:\s*40px/s);
  assert.match(designTokens, /\.auth-layout\s*\{[^}]*min-height:\s*0/s);
  assert.match(designTokens, /\.site-header\s*\{[^}]*min-width:\s*0/s);
});
