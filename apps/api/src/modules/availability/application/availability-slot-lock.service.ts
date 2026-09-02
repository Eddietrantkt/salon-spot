import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/**
 * Serializes every lifecycle command for one Workspace calendar day.
 * Callers must use this before changing an AvailabilitySlot state.
 */
@Injectable()
export class AvailabilitySlotLockService {
  async lockSlot(tx: Prisma.TransactionClient, slotId: string) {
    const candidate = await tx.availabilitySlot.findUnique({
      where: { id: slotId },
      select: { id: true, workspaceId: true, localDate: true }
    });
    if (!candidate) throw new NotFoundException('Availability slot was not found.');

    await tx.workspaceCalendarLock.createMany({
      data: [{ workspaceId: candidate.workspaceId, localDate: candidate.localDate }],
      skipDuplicates: true
    });
    await tx.$queryRaw<Array<{ workspaceId: string }>>(Prisma.sql`
      SELECT workspaceId
      FROM WorkspaceCalendarLock
      WHERE workspaceId = ${candidate.workspaceId} AND localDate = ${candidate.localDate}
      FOR UPDATE
    `);
    await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT id FROM AvailabilitySlot WHERE id = ${slotId} FOR UPDATE
    `);

    const slot = await tx.availabilitySlot.findUnique({
      where: { id: slotId },
      include: {
        workspace: { select: { id: true, name: true, status: true, salon: { select: { name: true, timezone: true } } } },
        rentalOption: { select: { label: true, priceCents: true } },
        hold: true,
        booking: true
      }
    });
    if (!slot) throw new NotFoundException('Availability slot was not found.');
    return slot;
  }
}
