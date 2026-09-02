import assert from 'node:assert/strict';
import test from 'node:test';
import type { OwnerMedia } from '@salon-spot/contracts';
import { mergeMedia } from '../src/features/owner/media-state.ts';

const readyMedia: OwnerMedia = {
  id: 'media_1',
  status: 'READY',
  contentType: 'image/jpeg',
  byteSize: 100,
  width: 10,
  height: 10,
  sortOrder: 0,
  failureReason: null,
  isCover: false,
  url: 'http://localhost/media_1'
};

test('removes an image from the Owner UI as soon as the API marks it DELETE_PENDING', () => {
  const result = mergeMedia([readyMedia], [{ ...readyMedia, status: 'DELETE_PENDING', url: null }]);

  assert.deepEqual(result, []);
});
