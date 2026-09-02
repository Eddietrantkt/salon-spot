import assert from 'node:assert/strict';
import test from 'node:test';
import type { SlotHold } from '@salon-spot/contracts';
import { activeCheckoutHolds } from '../src/features/booking/booking-session-state.ts';

const baseHold: SlotHold = {
  id: 'hold_1', slotId: 'slot_1', workspaceId: 'workspace_1', workspaceName: 'Chair One', salonName: 'Salon One', timezone: 'Asia/Ho_Chi_Minh', rentalOptionLabel: '2 giờ', priceCents: 250000,
  startsAt: '2099-12-11T02:00:00.000Z', endsAt: '2099-12-11T04:00:00.000Z', expiresAt: '2099-12-10T00:10:00.000Z'
};

test('restores every active hold in expiry order and drops holds that have expired in the UI', () => {
  const result = activeCheckoutHolds([
    { ...baseHold, id: 'expired', expiresAt: '2099-12-10T00:00:00.000Z' },
    { ...baseHold, id: 'later', expiresAt: '2099-12-10T00:20:00.000Z' },
    { ...baseHold, id: 'first', expiresAt: '2099-12-10T00:05:00.000Z' }
  ], new Date('2099-12-10T00:00:00.000Z'));

  assert.deepEqual(result.map((hold) => hold.id), ['first', 'later']);
});
