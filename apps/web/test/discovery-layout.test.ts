import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const discoveryPage = await readFile(new URL('../src/features/discovery/pages/discovery-page.tsx', import.meta.url), 'utf8');
const styles = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8');

test('stacks the Stitch-style hero search form on narrow screens', () => {
  assert.match(styles, /\.discovery-hero-search\s+\.search-form-hero\s*\{[^}]*grid-template-columns:\s*1fr/s);
  assert.match(styles, /\.discovery-hero-search\s+\.search-submit\s*\{[^}]*width:\s*100%/s);
});

test('uses the Stitch-style bento photo grid with an availability trust panel', () => {
  assert.match(discoveryPage, /discovery-photo-grid/);
  assert.match(discoveryPage, /ResilientImage/);
  assert.match(discoveryPage, /discovery-trust-card/);
  assert.match(discoveryPage, /Live availability/);
  assert.doesNotMatch(discoveryPage, /visual-window|visual-orbit|visual-note/);
  assert.match(styles, /\.discovery-photo-grid\s*\{[^}]*grid-template-columns/s);
  assert.match(styles, /\.discovery-photo-primary\s*\{[^}]*grid-row:\s*1\s*\/\s*3/s);
});
