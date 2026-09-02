import { BadRequestException, ConflictException } from '@nestjs/common';
import { AvailabilitySlotStatus, WorkspaceStatus } from '@prisma/client';
import { PrismaService } from '../../../common/database/prisma/prisma.service.js';
import { OwnerAvailabilityService } from './owner-availability.service.js';

const localDate = '2099-12-11';
const firstStart = new Date('2099-12-11T02:00:00.000Z');
const firstEnd = new Date('2099-12-11T04:00:00.000Z');
const secondStart = new Date('2099-12-11T04:00:00.000Z');
const secondEnd = new Date('2099-12-11T06:00:00.000Z');

describe('OwnerAvailabilityService', () => {
  it('opens missing slots and reopens blocked slots under the Workspace calendar lock', async () => {
    const blocked = slot('slot_1', firstStart, firstEnd, AvailabilitySlotStatus.BLOCKED);
    const saved = [
      slot('slot_1', firstStart, firstEnd, AvailabilitySlotStatus.OPEN),
      slot('slot_2', secondStart, secondEnd, AvailabilitySlotStatus.OPEN)
    ];
    const { service, tx } = harness([blocked], saved);

    const result = await service.openFixedSlots(
      'salon_1',
      'workspace_1',
      'owner_1',
      { localDate, periods: ['09:00-11:00', '11:00-13:00'] },
      'idempotency_1',
      'request_1'
    );

    expect(tx.workspaceCalendarLock.createMany).toHaveBeenCalledWith({
      data: [{ workspaceId: 'workspace_1', localDate: new Date(`${localDate}T00:00:00.000Z`) }],
      skipDuplicates: true
    });
    expect(tx.$queryRaw).toHaveBeenCalled();
    expect(tx.availabilitySlot.createMany).toHaveBeenCalledWith(expect.objectContaining({
      skipDuplicates: true,
      data: [expect.objectContaining({ workspaceId: 'workspace_1', startsAt: secondStart, status: AvailabilitySlotStatus.OPEN })]
    }));
    expect(tx.availabilitySlot.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['slot_1'] }, status: AvailabilitySlotStatus.BLOCKED },
      data: { status: AvailabilitySlotStatus.OPEN }
    });
    expect(result).toEqual({
      localDate,
      slots: [
        { ...saved[0], period: '09:00-11:00', startsAt: firstStart.toISOString(), endsAt: firstEnd.toISOString() },
        { ...saved[1], period: '11:00-13:00', startsAt: secondStart.toISOString(), endsAt: secondEnd.toISOString() }
      ]
    });
    expect(tx.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'WORKSPACE_FIXED_SLOTS_OPENED', actorUserId: 'owner_1' })
    });
  });

  it('blocks both existing open and previously missing fixed slots', async () => {
    const open = slot('slot_1', firstStart, firstEnd, AvailabilitySlotStatus.OPEN);
    const saved = [
      slot('slot_1', firstStart, firstEnd, AvailabilitySlotStatus.BLOCKED),
      slot('slot_2', secondStart, secondEnd, AvailabilitySlotStatus.BLOCKED)
    ];
    const { service, tx } = harness([open], saved);

    const result = await service.blockFixedSlots(
      'salon_1',
      'workspace_1',
      'owner_1',
      { localDate, periods: ['09:00-11:00', '11:00-13:00'] },
      'idempotency_2'
    );

    expect(tx.availabilitySlot.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['slot_1'] }, status: AvailabilitySlotStatus.OPEN },
      data: { status: AvailabilitySlotStatus.BLOCKED }
    });
    expect(tx.availabilitySlot.createMany).toHaveBeenCalledWith(expect.objectContaining({
      data: [expect.objectContaining({ startsAt: secondStart, status: AvailabilitySlotStatus.BLOCKED })]
    }));
    expect(result.slots.every((item: { status: AvailabilitySlotStatus }) => item.status === AvailabilitySlotStatus.BLOCKED)).toBe(true);
    expect(tx.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'WORKSPACE_FIXED_SLOTS_BLOCKED' })
    });
  });

  it.each([
    [AvailabilitySlotStatus.HELD, 'ACTIVE_CHECKOUT_IMPACT'],
    [AvailabilitySlotStatus.BOOKED, 'BOOKED_SLOT_IMMUTABLE']
  ])('rejects the entire batch when a selected slot is %s', async (status, code) => {
    const existing = [slot('slot_1', firstStart, firstEnd, status)];
    const { service, tx } = harness(existing, existing);

    const promise = service.blockFixedSlots(
      'salon_1',
      'workspace_1',
      'owner_1',
      { localDate, periods: ['09:00-11:00'] },
      `idempotency_${status}`
    );

    await expect(promise).rejects.toBeInstanceOf(ConflictException);
    await expect(promise).rejects.toMatchObject({ response: expect.objectContaining({ code }) });
    expect(tx.availabilitySlot.createMany).not.toHaveBeenCalled();
    expect(tx.availabilitySlot.updateMany).not.toHaveBeenCalled();
  });

  it('rejects changes to current or past Salon-local dates with the contract error code', async () => {
    const { service, tx } = harness([], []);
    const promise = service.openFixedSlots(
      'salon_1',
      'workspace_1',
      'owner_1',
      { localDate: '2000-01-01', periods: ['09:00-11:00'] },
      'idempotency_past'
    );

    await expect(promise).rejects.toBeInstanceOf(BadRequestException);
    await expect(promise).rejects.toMatchObject({ response: expect.objectContaining({ code: 'PAST_SLOT_IMMUTABLE' }) });
    expect(tx.workspaceCalendarLock.createMany).not.toHaveBeenCalled();
  });

  it('reads the authoritative schedule for one Workspace and local date', async () => {
    const saved = [slot('slot_1', firstStart, firstEnd, AvailabilitySlotStatus.OPEN)];
    const workspace = publishedWorkspace();
    const prisma = {
      workspace: { findFirst: jest.fn().mockResolvedValue(workspace) },
      availabilitySlot: { findMany: jest.fn().mockResolvedValue(saved) }
    } as unknown as PrismaService;

    const result = await new OwnerAvailabilityService(prisma).getSchedule('salon_1', 'workspace_1', localDate);

    expect(result.slots).toEqual([
      { ...saved[0], period: '09:00-11:00', startsAt: firstStart.toISOString(), endsAt: firstEnd.toISOString() }
    ]);
    expect(prisma.availabilitySlot.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { workspaceId: 'workspace_1', localDate: new Date(`${localDate}T00:00:00.000Z`) }
    }));
  });
});

function harness(existing: ReturnType<typeof slot>[], saved: ReturnType<typeof slot>[]) {
  const tx = {
    workspace: { findFirst: jest.fn().mockResolvedValue(publishedWorkspace()) },
    workspaceCalendarLock: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
    $queryRaw: jest.fn().mockResolvedValue([{ workspaceId: 'workspace_1' }]),
    availabilitySlot: {
      findMany: jest.fn().mockResolvedValueOnce(existing).mockResolvedValueOnce(saved),
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 })
    },
    auditEvent: { create: jest.fn().mockResolvedValue({}) },
    idempotencyRecord: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}) }
  };
  const prisma = {
    idempotencyRecord: { findUnique: jest.fn().mockResolvedValue(null) },
    $transaction: jest.fn((work: (client: typeof tx) => unknown) => work(tx))
  } as unknown as PrismaService;
  return { service: new OwnerAvailabilityService(prisma), tx };
}

function publishedWorkspace() {
  return {
    id: 'workspace_1',
    status: WorkspaceStatus.PUBLISHED,
    salon: { timezone: 'Asia/Ho_Chi_Minh' },
    rentalOptions: [{ id: 'option_1' }]
  };
}

function slot(id: string, startsAt: Date, endsAt: Date, status: AvailabilitySlotStatus) {
  return { id, startsAt, endsAt, status };
}
