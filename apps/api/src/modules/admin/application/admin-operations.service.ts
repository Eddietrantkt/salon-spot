import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AvailabilitySlotStatus, BookingStatus, MembershipRole, OutboxStatus, UserStatus, WorkspaceStatus } from '@prisma/client';
import type {
  AdminAuditEventsResponse,
  AdminOutboxEventsResponse,
  AdminOverviewResponse,
  AdminWorkerHealth,
  AdminUser,
  AdminUsersResponse,
  UpdateAdminUserStatusResponse
} from '@salon-spot/contracts';
import { PrismaService } from '../../../common/database/prisma/prisma.service.js';
import { executeIdempotently } from '../../../common/http/idempotency.js';
import { WORKER_NAMES } from '../../../common/worker/worker-health.service.js';
import type { AdminUserQuery } from '../presentation/dto/admin-user-query.dto.js';
import type { UpdateUserStatusDto } from '../presentation/dto/update-user-status.dto.js';

const adminUserSelection = {
  id: true,
  email: true,
  displayName: true,
  status: true,
  createdAt: true,
  adminAccess: { select: { userId: true } },
  _count: {
    select: {
      memberships: { where: { role: MembershipRole.OWNER } },
      bookings: true
    }
  }
} as const;

type AdminUserRecord = {
  id: string;
  email: string;
  displayName: string;
  status: UserStatus;
  createdAt: Date;
  adminAccess: { userId: string } | null;
  _count: { memberships: number; bookings: number };
};

/** Read-mostly operations surface. All state changes are deliberate, auditable commands. */
@Injectable()
export class AdminOperationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(): Promise<AdminOverviewResponse> {
    const [activeUsers, suspendedUsers, salons, draftWorkspaces, publishedWorkspaces, archivedWorkspaces, confirmedBookings, cancelledBookings, completedBookings, openSlots, heldSlots, bookedSlots, blockedSlots, pendingOutbox, processingOutbox, failedOutbox, heartbeats] = await this.prisma.$transaction([
      this.prisma.user.count({ where: { status: UserStatus.ACTIVE } }),
      this.prisma.user.count({ where: { status: UserStatus.SUSPENDED } }),
      this.prisma.salon.count(),
      this.prisma.workspace.count({ where: { status: WorkspaceStatus.DRAFT } }),
      this.prisma.workspace.count({ where: { status: WorkspaceStatus.PUBLISHED } }),
      this.prisma.workspace.count({ where: { status: WorkspaceStatus.ARCHIVED } }),
      this.prisma.booking.count({ where: { status: BookingStatus.CONFIRMED } }),
      this.prisma.booking.count({ where: { status: BookingStatus.CANCELLED } }),
      this.prisma.booking.count({ where: { status: BookingStatus.COMPLETED } }),
      this.prisma.availabilitySlot.count({ where: { status: AvailabilitySlotStatus.OPEN } }),
      this.prisma.availabilitySlot.count({ where: { status: AvailabilitySlotStatus.HELD } }),
      this.prisma.availabilitySlot.count({ where: { status: AvailabilitySlotStatus.BOOKED } }),
      this.prisma.availabilitySlot.count({ where: { status: AvailabilitySlotStatus.BLOCKED } }),
      this.prisma.outboxEvent.count({ where: { status: OutboxStatus.PENDING } }),
      this.prisma.outboxEvent.count({ where: { status: OutboxStatus.PROCESSING } }),
      this.prisma.outboxEvent.count({ where: { status: OutboxStatus.FAILED } }),
      this.prisma.workerHeartbeat.findMany({ select: { workerName: true, lastSucceededAt: true, lastFailedAt: true, lastError: true } })
    ]);

    return {
      generatedAt: new Date().toISOString(),
      users: { active: activeUsers, suspended: suspendedUsers },
      salons,
      workspaces: { draft: draftWorkspaces, published: publishedWorkspaces, archived: archivedWorkspaces },
      bookings: { confirmed: confirmedBookings, cancelled: cancelledBookings, completed: completedBookings },
      slots: { open: openSlots, held: heldSlots, booked: bookedSlots, blocked: blockedSlots },
      outbox: { pending: pendingOutbox, processing: processingOutbox, failed: failedOutbox },
      workers: WORKER_NAMES.map((name) => this.toWorkerHealth(name, heartbeats.find((heartbeat) => heartbeat.workerName === name)))
    };
  }

  async listUsers(query: AdminUserQuery): Promise<AdminUsersResponse> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const search = query.search?.trim();
    const where = {
      ...(query.status ? { status: query.status } : {}),
      ...(search ? { OR: [{ email: { contains: search } }, { displayName: { contains: search } }] } : {})
    };
    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize, select: adminUserSelection }),
      this.prisma.user.count({ where })
    ]);
    return { data: users.map((user) => this.toAdminUser(user)), meta: { page, pageSize, total } };
  }

  async updateUserStatus(
    actorUserId: string,
    userId: string,
    input: UpdateUserStatusDto,
    idempotencyKey: string,
    requestId?: string
  ): Promise<UpdateAdminUserStatusResponse> {
    if (actorUserId === userId) throw new BadRequestException('Administrators cannot change their own account status.');

    return executeIdempotently(this.prisma, actorUserId, 'admin-user-status-update', idempotencyKey, { userId, ...input }, async (tx) => {
      const current = await tx.user.findUnique({ where: { id: userId }, select: { id: true, status: true, adminAccess: { select: { userId: true } } } });
      if (!current) throw new NotFoundException('User was not found.');
      if (current.adminAccess) throw new ForbiddenException('Administrator accounts require a break-glass operations procedure.');

      const user = await tx.user.update({ where: { id: userId }, data: { status: input.status }, select: adminUserSelection });
      if (input.status === UserStatus.SUSPENDED) {
        await tx.authSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
      }
      await tx.auditEvent.create({
        data: {
          actorUserId,
          entityType: 'User',
          entityId: userId,
          action: input.status === UserStatus.SUSPENDED ? 'ADMIN_USER_SUSPENDED' : 'ADMIN_USER_REACTIVATED',
          requestId,
          before: { status: current.status },
          after: { status: input.status, reason: input.reason.trim() }
        }
      });
      return { user: this.toAdminUser(user) };
    });
  }

  async listAuditEvents(): Promise<AdminAuditEventsResponse> {
    const events = await this.prisma.auditEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, action: true, entityType: true, entityId: true, requestId: true, createdAt: true, actor: { select: { email: true } } }
    });
    return { events: events.map((event) => ({ ...event, actorEmail: event.actor?.email ?? null, createdAt: event.createdAt.toISOString() })) };
  }

  async listOutboxEvents(): Promise<AdminOutboxEventsResponse> {
    const events = await this.prisma.outboxEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, topic: true, status: true, attempts: true, availableAt: true, createdAt: true }
    });
    return { events: events.map((event) => ({ ...event, availableAt: event.availableAt.toISOString(), createdAt: event.createdAt.toISOString() })) };
  }

  private toAdminUser(user: AdminUserRecord): AdminUser {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      status: user.status,
      createdAt: user.createdAt.toISOString(),
      isAdmin: Boolean(user.adminAccess),
      ownedSalonCount: user._count.memberships,
      bookingCount: user._count.bookings
    };
  }

  private toWorkerHealth(
    name: AdminWorkerHealth['name'],
    heartbeat: { workerName: string; lastSucceededAt: Date | null; lastFailedAt: Date | null; lastError: string | null } | undefined
  ): AdminWorkerHealth {
    if (!heartbeat) return { name, status: 'UNKNOWN', lastSucceededAt: null, lastFailedAt: null, lastError: null };
    const now = Date.now();
    const lastSucceededAt = heartbeat.lastSucceededAt?.toISOString() ?? null;
    const lastFailedAt = heartbeat.lastFailedAt?.toISOString() ?? null;
    const lastSuccessMs = heartbeat.lastSucceededAt?.getTime() ?? 0;
    const lastFailureMs = heartbeat.lastFailedAt?.getTime() ?? 0;
    const status: AdminWorkerHealth['status'] = lastFailureMs > lastSuccessMs ? 'FAILED' : now - lastSuccessMs > 15_000 ? 'STALE' : 'HEALTHY';
    return { name, status, lastSucceededAt, lastFailedAt, lastError: heartbeat.lastError };
  }
}
