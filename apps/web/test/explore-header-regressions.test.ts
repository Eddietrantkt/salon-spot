import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const styles = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8');
const searchForm = await readFile(new URL('../src/features/discovery/components/search-workspaces-form.tsx', import.meta.url), 'utf8');

test('desktop navigation hides the native scrollbar beside account actions', () => {
  assert.match(styles, /\.app-nav\s*\{[^}]*scrollbar-width:\s*none/s);
  assert.match(styles, /\.app-nav\s*\{[^}]*overflow-y:\s*hidden/s);
  assert.match(styles, /\.app-nav::-webkit-scrollbar\s*\{[^}]*display:\s*none/s);
  assert.match(styles, /\.account-signout\s*\{[^}]*flex:\s*0 0 auto/s);
});

test('Explore search form keeps only contract-backed location and date controls', () => {
  assert.match(searchForm, /search-location-field/);
  assert.match(searchForm, /type="date"/);
  assert.match(searchForm, /Find spaces/);
  assert.doesNotMatch(searchForm, /Specialty|SESSION PLANNER/);
});
