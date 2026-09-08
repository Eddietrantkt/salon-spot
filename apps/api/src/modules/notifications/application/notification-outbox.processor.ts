import { Injectable, Logger } from '@nestjs/common';
import {
  NotificationChannel,
  NotificationDeliveryStatus,
  NotificationType,
  OutboxStatus,
  Prisma,
  UserStatus,
  type OutboxEvent
} from '@prisma/client';
import { PrismaService } from '../../../common/database/prisma/prisma.service.js';

const LEASE_MS = 60_000;
const SUPPORTED_TOPICS = ['BOOKING_CONFIRMED', 'BOOKING_CANCELLED', 'BOOKING_COMPLETED'] as const;

const EVENT_TEMPLATES: Record<(typeof SUPPORTED_TOPICS)[number], {
  type: NotificationType;
  titleKey: string;
  bodyKey: string;
}> = {
  BOOKING_CONFIRMED: {
    type: NotificationType.BOOKING_CONFIRMED,
    titleKey: 'notifications.bookingConfirmed.title',
    bodyKey: 'notifications.bookingConfirmed.body'
  },
  BOOKING_CANCELLED: {
    type: NotificationType.BOOKING_CANCELLED,
    titleKey: 'notifications.bookingCancelled.title',
    bodyKey: 'notifications.bookingCancelled.body'
  },
  BOOKING_COMPLETED: {
    type: NotificationType.BOOKING_COMPLETED,
    titleKey: 'notifications.bookingCompleted.title',
    bodyKey: 'notifications.bookingCompleted.body'
  }
};

/**
 * Deep post-commit module: callers only schedule batches; recipient resolution,
 * deduplication, inbox materialization and lease-safe completion stay internal.
 */
@Injectable()
export class NotificationOutboxProcessor {
  private readonly logger = new Logger(NotificationOutboxProcessor.name);

  constructor(private readonly prisma: PrismaService) {}

  async processBatch(limit = 20): Promise<number> {
    const now = new Date();
    const events = await this.prisma.outboxEvent.findMany({
      where: {
        topic: { in: [...SUPPORTED_TOPICS] },
        OR: [
          { status: { in: [OutboxStatus.PENDING, OutboxStatus.FAILED] }, availableAt: { lte: now } },
          { status: OutboxStatus.PROCESSING, availableAt: { lte: now } }
        ]
      },
      orderBy: { createdAt: 'asc' },
      take: limit
    });

    let delivered = 0;
    for (const event of events) {
      const leaseExpiresAt = new Date(Date.now() + LEASE_MS);
      const claimed = await this.prisma.outboxEvent.updateMany({
        where: {
          id: event.id,
          OR: [
            { status: { in: [OutboxStatus.PENDING, OutboxStatus.FAILED] }, availableAt: { lte: now } },
            { status: OutboxStatus.PROCESSING, availableAt: { lte: now } }
          ]
        },
        data: { status: OutboxStatus.PROCESSING, attempts: { increment: 1 }, availableAt: leaseExpiresAt }
      });
      if (claimed.count !== 1) continue;

      try {
        await this.materialize(event, leaseExpiresAt);
        delivered += 1;
      } catch (error) {
        const delaySeconds = Math.min(300, 2 ** Math.min(event.attempts + 1, 8));
        await this.prisma.outboxEvent.updateMany({
          where: { id: event.id, status: OutboxStatus.PROCESSING, availableAt: leaseExpiresAt },
          data: { status: OutboxStatus.FAILED, availableAt: new Date(Date.now() + delaySeconds * 1_000) }
        });
        this.logger.error(JSON.stringify({
          service: 'notification-outbox',
          event: 'materialization_failed',
          outboxEventId: event.id,
          topic: event.topic,
          error: error instanceof Error ? error.message : 'Unknown error'
        }));
      }
    }
    return delivered;
  }

  private async materialize(event: OutboxEvent, leaseExpiresAt: Date): Promise<void> {
    if (!isSupportedTopic(event.topic)) throw new Error(`Unsupported notification topic: ${event.topic}`);
    const bookingId = bookingIdFrom(event.payload);
    const template = EVENT_TEMPLATES[event.topic];

    await this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        select: {
          id: true,
          workspaceName: true,
          startsAt: true,
          salonTimezone: true,
          localDate: true,
          professionalUserId: true,
          professional: { select: { status: true } },
          slot: {
            select: {
              workspace: {
                select: {
                  salon: {
                    select: {
                      memberships: {
                        where: { user: { status: UserStatus.ACTIVE } },
                        select: { userId: true }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      });
      if (!booking) throw new Error(`Booking ${bookingId} no longer exists.`);

      const recipientIds = new Set<string>(
        booking.slot.workspace.salon.memberships.map((membership) => membership.userId)
      );
      if (booking.professional.status === UserStatus.ACTIVE) recipientIds.add(booking.professionalUserId);

      const bookingPayload = {
        bookingId: booking.id,
        workspaceName: booking.workspaceName,
        startsAt: booking.startsAt.toISOString(),
        salonTimezone: booking.salonTimezone,
        localDate: booking.localDate.toISOString().slice(0, 10)
      } satisfies Record<string, string>;

      for (const recipientUserId of recipientIds) {
        const notification = await tx.notification.upsert({
          where: {
            sourceEventId_recipientUserId_type: {
              sourceEventId: event.id,
              recipientUserId,
              type: template.type
            }
          },
          update: {},
          create: {
            sourceEventId: event.id,
            recipientUserId,
            type: template.type,
            titleKey: template.titleKey,
            bodyKey: template.bodyKey,
            payload: {
              ...bookingPayload,
              recipientRole: recipientUserId === booking.professionalUserId ? 'PROFESSIONAL' : 'OWNER'
            },
            entityType: 'Booking',
            entityId: booking.id
          },
          select: { id: true }
        });
        await tx.notificationDelivery.upsert({
          where: { notificationId_channel: { notificationId: notification.id, channel: NotificationChannel.IN_APP } },
          update: {},
          create: {
            notificationId: notification.id,
            channel: NotificationChannel.IN_APP,
            status: NotificationDeliveryStatus.DELIVERED,
            attempts: 1,
            deliveredAt: new Date()
          }
        });
      }

      const completed = await tx.outboxEvent.updateMany({
        where: { id: event.id, status: OutboxStatus.PROCESSING, availableAt: leaseExpiresAt },
        data: { status: OutboxStatus.DELIVERED }
      });
      if (completed.count !== 1) throw new Error(`Notification lease was lost for outbox ${event.id}.`);
    });
  }
}

function isSupportedTopic(topic: string): topic is (typeof SUPPORTED_TOPICS)[number] {
  return SUPPORTED_TOPICS.some((supported) => supported === topic);
}

function bookingIdFrom(payload: Prisma.JsonValue): string {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('Notification event payload must be an object.');
  const bookingId = payload.bookingId;
  if (typeof bookingId !== 'string' || !bookingId) throw new Error('Notification event payload is missing bookingId.');
  return bookingId;
}
