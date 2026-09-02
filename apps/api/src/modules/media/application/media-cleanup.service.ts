import { Injectable, Logger } from '@nestjs/common';
import { MediaStatus, OutboxStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/database/prisma/prisma.service.js';
import { MediaStorageService, type MediaParentKind } from './media-storage.service.js';

interface MediaDeletePayload {
  kind: MediaParentKind;
  mediaId: string;
  storageKey: string;
}

const STALE_UPLOAD_GRACE_MS = 5 * 60 * 1000;
const STALE_PROCESSING_MS = 10 * 60 * 1000;
const OUTBOX_LEASE_MS = 60 * 1000;

@Injectable()
export class MediaCleanupService {
  private readonly logger = new Logger(MediaCleanupService.name);

  constructor(private readonly prisma: PrismaService, private readonly storage: MediaStorageService) {}

  async processBatch(limit = 10): Promise<number> {
    const now = new Date();
    // While an event is PROCESSING, availableAt is the expiry of its lease.
    // This keeps the schema small while allowing a later worker to reclaim work after a crash.
    const events = await this.prisma.outboxEvent.findMany({
      where: {
        topic: { in: ['MEDIA_DELETE_REQUESTED', 'MEDIA_STORAGE_CLEANUP_REQUESTED'] },
        OR: [
          { status: { in: [OutboxStatus.PENDING, OutboxStatus.FAILED] }, availableAt: { lte: now } },
          { status: OutboxStatus.PROCESSING, availableAt: { lte: now } }
        ]
      },
      orderBy: { createdAt: 'asc' },
      take: limit
    });
    let processed = 0;
    for (const event of events) {
      const leaseExpiresAt = new Date(now.getTime() + OUTBOX_LEASE_MS);
      const claimed = await this.prisma.outboxEvent.updateMany({
        where: {
          id: event.id,
          OR: [
            { status: { in: [OutboxStatus.PENDING, OutboxStatus.FAILED] }, availableAt: { lte: now } },
            { status: OutboxStatus.PROCESSING, availableAt: { lte: now } }
          ]
        },
        data: {
          status: OutboxStatus.PROCESSING,
          attempts: { increment: 1 },
          availableAt: leaseExpiresAt
        }
      });
      if (claimed.count !== 1) continue;
      try {
        const payload = this.parsePayload(event.payload);
        await this.storage.delete(payload.storageKey);
        const completed = await this.prisma.$transaction(async (tx) => {
          const completion = await tx.outboxEvent.updateMany({
            where: { id: event.id, status: OutboxStatus.PROCESSING, availableAt: leaseExpiresAt },
            data: { status: OutboxStatus.DELIVERED }
          });
          if (completion.count !== 1) return false;
          if (event.topic === 'MEDIA_DELETE_REQUESTED') {
            if (payload.kind === 'salon') {
              await tx.salonMedia.updateMany({ where: { id: payload.mediaId, status: MediaStatus.DELETE_PENDING }, data: { status: MediaStatus.DELETED } });
            } else {
              await tx.workspaceMedia.updateMany({ where: { id: payload.mediaId, status: MediaStatus.DELETE_PENDING }, data: { status: MediaStatus.DELETED } });
            }
          }
          await tx.auditEvent.create({
            data: {
              entityType: payload.kind === 'salon' ? 'SalonMedia' : 'WorkspaceMedia',
              entityId: payload.mediaId,
              action: event.topic === 'MEDIA_DELETE_REQUESTED' ? 'MEDIA_DELETED' : 'MEDIA_STORAGE_CLEANED'
            }
          });
          return true;
        });
        if (completed) processed += 1;
      } catch (error) {
        const delaySeconds = Math.min(300, 2 ** Math.min(event.attempts + 1, 8));
        const retry = await this.prisma.outboxEvent.updateMany({
          where: { id: event.id, status: OutboxStatus.PROCESSING, availableAt: leaseExpiresAt },
          data: {
            status: OutboxStatus.FAILED,
            availableAt: new Date(Date.now() + delaySeconds * 1000)
          }
        });
        if (retry.count === 1) this.logger.warn(`Media cleanup event ${event.id} failed and will retry: ${error instanceof Error ? error.message : 'unknown error'}`);
      }
    }
    return processed;
  }

  async expireStaleUploads(limit = 10): Promise<number> {
    const now = new Date();
    const expiredBefore = new Date(now.getTime() - STALE_UPLOAD_GRACE_MS);
    const [salonMedia, workspaceMedia] = await Promise.all([
      this.prisma.salonMedia.findMany({
        where: { status: MediaStatus.PENDING_UPLOAD, uploadExpiresAt: { lte: expiredBefore } },
        orderBy: { uploadExpiresAt: 'asc' },
        take: limit,
        select: { id: true, storageKey: true }
      }),
      this.prisma.workspaceMedia.findMany({
        where: { status: MediaStatus.PENDING_UPLOAD, uploadExpiresAt: { lte: expiredBefore } },
        orderBy: { uploadExpiresAt: 'asc' },
        take: limit,
        select: { id: true, storageKey: true }
      })
    ]);

    let expired = 0;
    for (const item of [
      ...salonMedia.map((media) => ({ ...media, kind: 'salon' as const })),
      ...workspaceMedia.map((media) => ({ ...media, kind: 'workspace' as const }))
    ]) {
      const changed = await this.prisma.$transaction(async (tx) => {
        const result = item.kind === 'salon'
          ? await tx.salonMedia.updateMany({ where: { id: item.id, status: MediaStatus.PENDING_UPLOAD, uploadExpiresAt: { lte: expiredBefore } }, data: { status: MediaStatus.REJECTED, failureReason: 'Upload intent expired.', uploadExpiresAt: null } })
          : await tx.workspaceMedia.updateMany({ where: { id: item.id, status: MediaStatus.PENDING_UPLOAD, uploadExpiresAt: { lte: expiredBefore } }, data: { status: MediaStatus.REJECTED, failureReason: 'Upload intent expired.', uploadExpiresAt: null } });
        if (result.count !== 1) return false;
        await tx.outboxEvent.create({ data: { topic: 'MEDIA_STORAGE_CLEANUP_REQUESTED', payload: { kind: item.kind, mediaId: item.id, storageKey: item.storageKey } } });
        await tx.auditEvent.create({ data: { entityType: item.kind === 'salon' ? 'SalonMedia' : 'WorkspaceMedia', entityId: item.id, action: 'MEDIA_UPLOAD_EXPIRED' } });
        return true;
      });
      if (changed) expired += 1;
    }
    return expired;
  }

  async recoverStaleProcessing(limit = 10): Promise<number> {
    const staleBefore = new Date(Date.now() - STALE_PROCESSING_MS);
    const [salonResult, workspaceResult] = await this.prisma.$transaction([
      this.prisma.salonMedia.updateMany({
        where: { status: MediaStatus.PROCESSING, updatedAt: { lte: staleBefore } },
        data: { status: MediaStatus.PENDING_UPLOAD, failureReason: 'Recovered after interrupted image processing.' },
        limit
      }),
      this.prisma.workspaceMedia.updateMany({
        where: { status: MediaStatus.PROCESSING, updatedAt: { lte: staleBefore } },
        data: { status: MediaStatus.PENDING_UPLOAD, failureReason: 'Recovered after interrupted image processing.' },
        limit
      })
    ]);
    const recovered = salonResult.count + workspaceResult.count;
    if (recovered > 0) this.logger.warn(`Recovered ${recovered} stale media processing record(s).`);
    return recovered;
  }

  private parsePayload(value: Prisma.JsonValue): MediaDeletePayload {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid media cleanup payload.');
    const payload = value as Record<string, Prisma.JsonValue>;
    if ((payload.kind !== 'salon' && payload.kind !== 'workspace') || typeof payload.mediaId !== 'string' || typeof payload.storageKey !== 'string') {
      throw new Error('Invalid media cleanup payload.');
    }
    return { kind: payload.kind, mediaId: payload.mediaId, storageKey: payload.storageKey };
  }
}
