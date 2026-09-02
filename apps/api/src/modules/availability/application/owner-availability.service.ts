import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AvailabilitySlotStatus, Prisma, WorkspaceStatus } from '@prisma/client';
import {
  FIXED_SLOT_PERIODS,
  type ApiErrorCode,
  type BlockWorkspaceSlotsInput,
  type BlockWorkspaceSlotsResponse,
  type FixedSlotPeriod,
  type OpenWorkspaceSlotsInput,
  type OpenWorkspaceSlotsResponse,
  type OwnerWorkspaceScheduleResponse
} from '@salon-spot/contracts';
import { PrismaService } from '../../../common/database/prisma/prisma.service.js';
import { executeIdempotently } from '../../../common/http/idempotency.js';

const periodTimes: Record<FixedSlotPeriod, readonly [string, string]> = {
  '09:00-11:00': ['09:00', '11:00'],
  '11:00-13:00': ['11:00', '13:00'],
  '13:00-15:00': ['13:00', '15:00'],
  '15:00-17:00': ['15:00', '17:00']
};

type ScheduleAction = 'open' | 'block';

interface WorkspaceScheduleContext {
  id: string;
  status: WorkspaceStatus;
  timezone: string;
  rentalOptionId: string | null;
}

interface SavedSlot {
  id: string;
  startsAt: Date;
  endsAt: Date;
  status: AvailabilitySlotStatus;
}

@Injectable()
export class OwnerAvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  async getSchedule(salonId: string, workspaceId: string, localDateInput: string): Promise<OwnerWorkspaceScheduleResponse> {
    const workspace = await this.getWorkspaceContext(this.prisma, salonId, workspaceId);
    const localDate = toDateOnly(localDateInput);
    const slots = await this.prisma.availabilitySlot.findMany({
      where: { workspaceId, localDate },
      orderBy: { startsAt: 'asc' },
      select: { id: true, startsAt: true, endsAt: true, status: true }
    });
    return this.toScheduleResponse(localDateInput, workspace.timezone, slots);
  }

  openFixedSlots(
    salonId: string,
    workspaceId: string,
    actorUserId: string,
    input: OpenWorkspaceSlotsInput,
    idempotencyKey: string,
    requestId?: string
  ): Promise<OpenWorkspaceSlotsResponse> {
    return this.mutateFixedSlots('open', salonId, workspaceId, actorUserId, input, idempotencyKey, requestId);
  }

  blockFixedSlots(
    salonId: string,
    workspaceId: string,
    actorUserId: string,
    input: BlockWorkspaceSlotsInput,
    idempotencyKey: string,
    requestId?: string
  ): Promise<BlockWorkspaceSlotsResponse> {
    return this.mutateFixedSlots('block', salonId, workspaceId, actorUserId, input, idempotencyKey, requestId);
  }

  private mutateFixedSlots(
    action: ScheduleAction,
    salonId: string,
    workspaceId: string,
    actorUserId: string,
    input: OpenWorkspaceSlotsInput,
    idempotencyKey: string,
    requestId?: string
  ): Promise<OpenWorkspaceSlotsResponse> {
    const scope = `owner-workspace-${action}-slots:${workspaceId}`;
    return executeIdempotently(this.prisma, actorUserId, scope, idempotencyKey, input, async (tx) => {
      const workspace = await this.getWorkspaceContext(tx, salonId, workspaceId);
      if (workspace.status !== WorkspaceStatus.PUBLISHED) {
        throw new BadRequestException('Publish Workspace before changing its rental schedule.');
      }
      if (!workspace.rentalOptionId) {
        throw new BadRequestException('Workspace must have a rental option before changing its schedule.');
      }
      this.assertFutureDate(input.localDate, workspace.timezone);

      const localDate = toDateOnly(input.localDate);
      await tx.workspaceCalendarLock.createMany({
        data: [{ workspaceId, localDate }],
        skipDuplicates: true
      });
      await tx.$queryRaw<Array<{ workspaceId: string }>>(Prisma.sql`
        SELECT workspaceId
        FROM WorkspaceCalendarLock
        WHERE workspaceId = ${workspaceId} AND localDate = ${localDate}
        FOR UPDATE
      `);

      const targets = input.periods.map((period) => {
        const [startTime, endTime] = periodTimes[period];
        return {
          startsAt: toUtcInstant(input.localDate, startTime, workspace.timezone),
          endsAt: toUtcInstant(input.localDate, endTime, workspace.timezone)
        };
      });
      const existing = await tx.availabilitySlot.findMany({
        where: {
          workspaceId,
          localDate,
          OR: targets.map((target) => ({ startsAt: target.startsAt, endsAt: target.endsAt }))
        },
        select: { id: true, startsAt: true, endsAt: true, status: true }
      });
      this.assertMutable(existing);

      const existingByStart = new Map(existing.map((slot) => [slot.startsAt.getTime(), slot]));
      const desiredStatus = action === 'open' ? AvailabilitySlotStatus.OPEN : AvailabilitySlotStatus.BLOCKED;
      const missing = targets.filter((target) => !existingByStart.has(target.startsAt.getTime()));
      const transitionIds = existing.filter((slot) => slot.status !== desiredStatus).map((slot) => slot.id);

      if (missing.length > 0) {
        await tx.availabilitySlot.createMany({
          data: missing.map((target) => ({
            workspaceId,
            rentalOptionId: workspace.rentalOptionId!,
            startsAt: target.startsAt,
            endsAt: target.endsAt,
            localDate,
            status: desiredStatus
          })),
          skipDuplicates: true
        });
      }
      if (transitionIds.length > 0) {
        await tx.availabilitySlot.updateMany({
          where: {
            id: { in: transitionIds },
            status: action === 'open' ? AvailabilitySlotStatus.BLOCKED : AvailabilitySlotStatus.OPEN
          },
          data: { status: desiredStatus }
        });
      }

      const saved = await tx.availabilitySlot.findMany({
        where: { workspaceId, localDate },
        orderBy: { startsAt: 'asc' },
        select: { id: true, startsAt: true, endsAt: true, status: true }
      });
      await tx.auditEvent.create({
        data: {
          actorUserId,
          entityType: 'Workspace',
          entityId: workspaceId,
          action: action === 'open' ? 'WORKSPACE_FIXED_SLOTS_OPENED' : 'WORKSPACE_FIXED_SLOTS_BLOCKED',
          requestId,
          after: {
            localDate: input.localDate,
            periods: input.periods,
            createdCount: missing.length,
            transitionedCount: transitionIds.length
          }
        }
      });
      return this.toScheduleResponse(input.localDate, workspace.timezone, saved);
    });
  }

  private async getWorkspaceContext(
    client: PrismaService | Prisma.TransactionClient,
    salonId: string,
    workspaceId: string
  ): Promise<WorkspaceScheduleContext> {
    const workspace = await client.workspace.findFirst({
      where: { id: workspaceId, salonId },
      select: {
        id: true,
        status: true,
        salon: { select: { timezone: true } },
        rentalOptions: { orderBy: { createdAt: 'asc' }, take: 1, select: { id: true } }
      }
    });
    if (!workspace) throw new NotFoundException('Workspace was not found in this Salon.');
    return {
      id: workspace.id,
      status: workspace.status,
      timezone: workspace.salon.timezone,
      rentalOptionId: workspace.rentalOptions[0]?.id ?? null
    };
  }

  private assertMutable(slots: SavedSlot[]): void {
    if (slots.some((slot) => slot.status === AvailabilitySlotStatus.BOOKED)) {
      throw codedConflict('BOOKED_SLOT_IMMUTABLE', 'A booked slot cannot be opened or blocked. Cancel the Booking through its lifecycle instead.');
    }
    if (slots.some((slot) => slot.status === AvailabilitySlotStatus.HELD)) {
      throw codedConflict('ACTIVE_CHECKOUT_IMPACT', 'A held slot cannot be opened or blocked while its hold is active.');
    }
  }

  private assertFutureDate(localDate: string, timezone: string): void {
    const today = localDateInTimezone(new Date(), timezone);
    if (localDate <= today) {
      throw new BadRequestException({ code: 'PAST_SLOT_IMMUTABLE' satisfies ApiErrorCode, message: 'Only future dates can be changed.' });
    }
  }

  private toScheduleResponse(localDate: string, timezone: string, slots: SavedSlot[]): OwnerWorkspaceScheduleResponse {
    return {
      localDate,
      slots: slots.map((slot) => ({
        id: slot.id,
        period: periodFor(slot, timezone),
        startsAt: slot.startsAt.toISOString(),
        endsAt: slot.endsAt.toISOString(),
        status: slot.status
      }))
    };
  }
}

function codedConflict(code: ApiErrorCode, message: string): ConflictException {
  return new ConflictException({ code, message });
}

function toDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function localDateInTimezone(now: Date, timezone: string): string {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(now)
    .filter((part) => part.type !== 'literal')
    .map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function toUtcInstant(localDate: string, time: string, timezone: string): Date {
  const [year, month, day] = localDate.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const wanted = Date.UTC(year, month - 1, day, hour, minute, 0);
  let instant = wanted;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = dateTimeParts(new Date(instant), timezone);
    const observed = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), 0);
    const next = wanted - (observed - instant);
    if (next === instant) break;
    instant = next;
  }
  return new Date(instant);
}

function periodFor(slot: SavedSlot, timezone: string): FixedSlotPeriod {
  const start = dateTimeParts(slot.startsAt, timezone);
  const end = dateTimeParts(slot.endsAt, timezone);
  const period = `${start.hour}:${start.minute}-${end.hour}:${end.minute}`;
  if (!FIXED_SLOT_PERIODS.includes(period as FixedSlotPeriod)) {
    throw new Error(`AvailabilitySlot ${slot.id} does not match a fixed MVP period.`);
  }
  return period as FixedSlotPeriod;
}

function dateTimeParts(instant: Date, timezone: string): Record<string, string> {
  return Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(instant).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
}
