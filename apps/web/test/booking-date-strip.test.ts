import assert from 'node:assert/strict';
import test from 'node:test';
import { bookingDateRange } from '../src/features/booking/booking-date-strip.ts';

test('keeps booking date choices consecutive across a month boundary', () => {
  assert.deepEqual(bookingDateRange('2026-10-30', 4), [
    '2026-10-30',
    '2026-10-31',
    '2026-11-01',
    '2026-11-02'
  ]);
});

test('uses the selected date as the start of the date strip', () => {
  assert.deepEqual(bookingDateRange('2026-02-28', 3), [
    '2026-02-28',
    '2026-03-01',
    '2026-03-02'
  ]);
});
