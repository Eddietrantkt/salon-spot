import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';

test('Vercel preserves the API proxy before falling back to the SPA entry point', async () => {
  const config = JSON.parse(await readFile(resolve('vercel.json'), 'utf8'));
  const rewrites = config.rewrites;

  assert.ok(Array.isArray(rewrites), 'Vercel rewrites must be configured.');
  assert.deepEqual(rewrites[0], {
    source: '/api/:path*',
    destination: 'https://salon-spot-api.onrender.com/api/:path*'
  });
  assert.deepEqual(rewrites.at(-1), {
    source: '/(.*)',
    destination: '/index.html'
  });
});
