import { ConflictException, Injectable } from '@nestjs/common';
import { AvailabilitySlotStatus, Prisma, WorkspaceStatus } from '@prisma/client';
import type { CreateSlotHoldResponse, MyHoldsResponse, SlotHold } from '@salon-spot/contracts';
import { PrismaService } from '../../../common/database/prisma/prisma.service.js';
import { executeIdempotently } from '../../../common/http/idempotency.js';
import { AvailabilityConfigService } from './availability-config.service.js';
import { AvailabilitySlotLockService } from './availability-slot-lock.service.js';
import { ProfessionalAccessService } from '../../professionals/application/professional-access.service.js';

@Injectable()
export class SlotHoldsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AvailabilityConfigService,
    private readonly locks: AvailabilitySlotLockService,
    private readonly professionals: ProfessionalAccessService
  ) {}

  async create(actorUserId: string, slotId: string, idempotencyKey: string, requestId?: string): Promise<CreateSlotHoldResponse> {
    await this.professionals.assertActive(actorUserId);
    return executeIdempotently(this.prisma, actorUserId, `availability-slot-hold:${slotId}`, idempotencyKey, { slotId }, async (tx) => {
      await this.professionals.assertActive(actorUserId, tx);
      const slot = await this.locks.lockSlot(tx, slotId);
      const now = new Date();
      if (slot.workspace.status !== WorkspaceStatus.PUBLISHED || slot.startsAt <= now || slot.status !== AvailabilitySlotStatus.OPEN) {
        throw unavailable();
      }
      const expiresAt = new Date(now.getTime() + this.config.holdTtlSeconds * 1_000);
      const hold = await tx.slotHold.create({ data: { availabilitySlotId: slot.id, professionalUserId: actorUserId, expiresAt } });
      const changed = await tx.availabilitySlot.updateMany({
        where: { id: slot.id, status: AvailabilitySlotStatus.OPEN },
        data: { status: AvailabilitySlotStatus.HELD }
      });
      if (changed.count !== 1) throw unavailable();
      const response = { hold: toContract(hold, slot) };
      await tx.auditEvent.create({
        data: {
          actorUserId,
          entityType: 'SlotHold',
          entityId: hold.id,
          action: 'SLOT_HELD',
          requestId,
          after: { slotId: slot.id, expiresAt: expiresAt.toISOString() }
        }
      });
      return response;
    });
  }

  async getMine(actorUserId: string): Promise<MyHoldsResponse> {
    await this.professionals.assertActive(actorUserId);
    const holds = await this.prisma.slotHold.findMany({
      where: { professionalUserId: actorUserId, expiresAt: { gt: new Date() }, slot: { status: AvailabilitySlotStatus.HELD } },
      orderBy: { expiresAt: 'asc' },
      include: {
        slot: {
          include: {
            workspace: { select: { id: true, name: true, status: true, salon: { select: { name: true, timezone: true } } } },
            rentalOption: { select: { label: true, priceCents: true } },
            hold: true,
            booking: true
          }
        }
      }
    });
    return { holds: holds.map((hold) => toContract(hold, hold.slot)) };
  }

  /** Safe to run repeatedly: each transaction releases only its still-expired HELD slot. */
  async expireBatch(limit = 50, now = new Date()): Promise<number> {
    const expired = await this.prisma.slotHold.findMany({
      where: { expiresAt: { lte: now } },
      orderBy: { expiresAt: 'asc' },
      take: limit,
      select: { id: true, availabilitySlotId: true }
    });
    let released = 0;
    for (const candidate of expired) {
      const changed = await this.prisma.$transaction(async (tx) => {
        const slot = await this.locks.lockSlot(tx, candidate.availabilitySlotId);
        if (slot.status !== AvailabilitySlotStatus.HELD || !slot.hold || slot.hold.id !== candidate.id || slot.hold.expiresAt > now) return false;
        const deleted = await tx.slotHold.deleteMany({ where: { id: candidate.id, expiresAt: { lte: now } } });
        if (deleted.count !== 1) return false;
        const reopened = await tx.availabilitySlot.updateMany({ where: { id: slot.id, status: AvailabilitySlotStatus.HELD }, data: { status: AvailabilitySlotStatus.OPEN } });
        if (reopened.count !== 1) throw new Error('Expired hold was removed without reopening its slot.');
        await tx.auditEvent.create({ data: { entityType: 'SlotHold', entityId: candidate.id, action: 'SLOT_HOLD_EXPIRED', after: { slotId: slot.id } } });
        return true;
      });
      if (changed) released += 1;
    }
    return released;
  }
}

type LockedSlot = Awaited<ReturnType<AvailabilitySlotLockService['lockSlot']>>;

function toContract(hold: { id: string; expiresAt: Date }, slot: LockedSlot): SlotHold {
  return {
    id: hold.id,
    slotId: slot.id,
    workspaceId: slot.workspace.id,
    workspaceName: slot.workspace.name,
    salonName: slot.workspace.salon.name,
    timezone: slot.workspace.salon.timezone,
    rentalOptionLabel: slot.rentalOption.label,
    priceCents: slot.rentalOption.priceCents,
    startsAt: slot.startsAt.toISOString(),
    endsAt: slot.endsAt.toISOString(),
    expiresAt: hold.expiresAt.toISOString()
  };
}

function unavailable(): ConflictException {
  return new ConflictException({ code: 'AVAILABILITY_CONFLICT', message: 'This slot is no longer available. Refresh and choose another slot.' });
}
