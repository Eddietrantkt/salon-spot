import test from 'node:test';
import assert from 'node:assert/strict';
import { formatSalonLocalDate, formatSalonTimeRange } from '../src/shared/date/format-salon-time.ts';

test('renders an instant in the Salon timezone rather than the viewer timezone', () => {
  assert.equal(
    formatSalonTimeRange('2099-12-11T17:00:00.000Z', '2099-12-11T19:00:00.000Z', 'Asia/Ho_Chi_Minh'),
    '00:00–02:00'
  );
});

test('keeps a Salon-local date stable across timezone boundaries', () => {
  assert.match(formatSalonLocalDate('2099-12-11'), /11/);
});
