import { AvailabilitySlotStatus, WorkspaceStatus } from '@prisma/client';
import { PrismaService } from '../../../common/database/prisma/prisma.service.js';
import { AvailabilityConfigService } from './availability-config.service.js';
import { AvailabilitySlotLockService } from './availability-slot-lock.service.js';
import { SlotHoldsService } from './slot-holds.service.js';
import { ProfessionalAccessService } from '../../professionals/application/professional-access.service.js';

describe('SlotHoldsService', () => {
  it('locks the calendar then atomically creates a hold and changes OPEN to HELD', async () => {
    const tx = transactionHarness();
    const prisma = prismaHarness(tx);
    const locks = { lockSlot: jest.fn().mockResolvedValue(lockedSlot()) } as unknown as AvailabilitySlotLockService;
    const config = { holdTtlSeconds: 600 } as AvailabilityConfigService;
    const professionals = activeProfessional();
    const service = new SlotHoldsService(prisma, config, locks, professionals);

    const result = await service.create('professional_1', 'slot_1', 'hold-key', 'request_1');

    expect(locks.lockSlot).toHaveBeenCalledWith(tx, 'slot_1');
    expect(professionals.assertActive).toHaveBeenNthCalledWith(1, 'professional_1');
    expect(professionals.assertActive).toHaveBeenNthCalledWith(2, 'professional_1', tx);
    expect(tx.slotHold.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ availabilitySlotId: 'slot_1', professionalUserId: 'professional_1' }) }));
    expect(tx.availabilitySlot.updateMany).toHaveBeenCalledWith({ where: { id: 'slot_1', status: AvailabilitySlotStatus.OPEN }, data: { status: AvailabilitySlotStatus.HELD } });
    expect(tx.auditEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'SLOT_HELD', requestId: 'request_1' }) });
    expect(result.hold).toMatchObject({ id: 'hold_1', slotId: 'slot_1', workspaceId: 'workspace_1' });
  });

  it('releases only an expired HELD hold and is safe to repeat', async () => {
    const now = new Date('2099-12-10T00:00:00.000Z');
    const tx = transactionHarness();
    const prisma = prismaHarness(tx, [{ id: 'hold_1', availabilitySlotId: 'slot_1' }]);
    const expiredSlot = { ...lockedSlot(), status: AvailabilitySlotStatus.HELD, hold: { id: 'hold_1', expiresAt: new Date(now.getTime() - 1), professionalUserId: 'professional_1' } };
    const locks = { lockSlot: jest.fn().mockResolvedValue(expiredSlot) } as unknown as AvailabilitySlotLockService;
    const service = new SlotHoldsService(prisma, { holdTtlSeconds: 600 } as AvailabilityConfigService, locks, activeProfessional());

    await expect(service.expireBatch(10, now)).resolves.toBe(1);
    expect(tx.slotHold.deleteMany).toHaveBeenCalledWith({ where: { id: 'hold_1', expiresAt: { lte: now } } });
    expect(tx.availabilitySlot.updateMany).toHaveBeenCalledWith({ where: { id: 'slot_1', status: AvailabilitySlotStatus.HELD }, data: { status: AvailabilitySlotStatus.OPEN } });
  });
});

function lockedSlot() {
  return {
    id: 'slot_1', localDate: new Date('2099-12-11T00:00:00.000Z'), startsAt: new Date('2099-12-11T02:00:00.000Z'), endsAt: new Date('2099-12-11T04:00:00.000Z'), status: AvailabilitySlotStatus.OPEN,
    workspace: { id: 'workspace_1', name: 'Chair One', status: WorkspaceStatus.PUBLISHED, salon: { name: 'Salon One', timezone: 'Asia/Ho_Chi_Minh' } },
    rentalOption: { label: '2 giờ', priceCents: 250000 }, hold: null, booking: null
  };
}

function transactionHarness() {
  return {
    slotHold: { create: jest.fn().mockResolvedValue({ id: 'hold_1', expiresAt: new Date('2099-12-10T00:10:00.000Z') }), deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
    availabilitySlot: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    auditEvent: { create: jest.fn().mockResolvedValue({}) },
    idempotencyRecord: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}) }
  };
}

function prismaHarness(tx: ReturnType<typeof transactionHarness>, expired: Array<{ id: string; availabilitySlotId: string }> = []) {
  return {
    idempotencyRecord: { findUnique: jest.fn().mockResolvedValue(null) },
    slotHold: { findMany: jest.fn().mockResolvedValue(expired) },
    $transaction: jest.fn((work: (client: typeof tx) => unknown) => work(tx))
  } as unknown as PrismaService;
}

function activeProfessional(): ProfessionalAccessService {
  return { assertActive: jest.fn().mockResolvedValue(undefined) } as unknown as ProfessionalAccessService;
}
