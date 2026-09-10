import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const designTokens = await readFile(new URL('../src/shared/design-tokens.css', import.meta.url), 'utf8');

test('stacks the hero search form when its content column is narrow', () => {
  assert.match(designTokens, /\.discovery-hero-intro\s*\{[^}]*container:\s*discovery-hero-intro\s*\/\s*inline-size/s);
  assert.match(designTokens, /@container\s+discovery-hero-intro\s*\(max-width:\s*560px\)/);
  assert.match(designTokens, /\.discovery-hero-intro\s+\.search-form-hero\s*\{[^}]*grid-template-columns:\s*1fr/s);
  assert.match(designTokens, /\.discovery-hero-intro\s+\.search-form-hero\s+\.search-submit\s*\{[^}]*width:\s*100%/s);
});
