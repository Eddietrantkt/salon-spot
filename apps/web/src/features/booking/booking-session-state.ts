import type { SlotHold } from '@salon-spot/contracts';

/** Keeps client checkout state aligned with the server's plural hold contract. */
export function activeCheckoutHolds(holds: SlotHold[], now: Date): SlotHold[] {
  return holds
    .filter((hold) => new Date(hold.expiresAt).getTime() > now.getTime())
    .slice()
    .sort((left, right) => new Date(left.expiresAt).getTime() - new Date(right.expiresAt).getTime());
}
