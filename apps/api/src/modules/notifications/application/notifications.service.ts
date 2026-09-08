import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  MarkAllNotificationsReadResponse,
  NotificationItem,
  NotificationPreferences,
  NotificationsResponse,
  NotificationUnreadCountResponse
} from '@salon-spot/contracts';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/database/prisma/prisma.service.js';
import { executeIdempotently } from '../../../common/http/idempotency.js';
import type { NotificationQueryDto } from '../presentation/dto/notification-query.dto.js';
import type { UpdateNotificationPreferencesDto } from '../presentation/dto/update-notification-preferences.dto.js';

const notificationSelection = {
  id: true,
  type: true,
  titleKey: true,
  bodyKey: true,
  payload: true,
  entityType: true,
  entityId: true,
  readAt: true,
  createdAt: true,
  expiresAt: true
} satisfies Prisma.NotificationSelect;

type NotificationRecord = Prisma.NotificationGetPayload<{ select: typeof notificationSelection }>;

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async listMine(actorUserId: string, query: NotificationQueryDto): Promise<NotificationsResponse> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.NotificationWhereInput = {
      recipientUserId: actorUserId,
      ...(query.status === 'read' ? { readAt: { not: null } } : query.status === 'unread' ? { readAt: null } : {})
    };
    const [notifications, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: notificationSelection
      }),
      this.prisma.notification.count({ where })
    ]);
    return { data: notifications.map(toNotificationItem), meta: { page, pageSize, total } };
  }

  async unreadCount(actorUserId: string): Promise<NotificationUnreadCountResponse> {
    return { unreadCount: await this.prisma.notification.count({ where: { recipientUserId: actorUserId, readAt: null } }) };
  }

  async markRead(actorUserId: string, notificationId: string, idempotencyKey: string): Promise<NotificationItem> {
    return executeIdempotently(
      this.prisma,
      actorUserId,
      `notification-read:${notificationId}`,
      idempotencyKey,
      { notificationId },
      async (tx) => {
        const current = await tx.notification.findFirst({
          where: { id: notificationId, recipientUserId: actorUserId },
          select: notificationSelection
        });
        if (!current) throw new NotFoundException('Notification was not found.');
        if (current.readAt) return toNotificationItem(current);
        const updated = await tx.notification.update({
          where: { id: notificationId },
          data: { readAt: new Date() },
          select: notificationSelection
        });
        return toNotificationItem(updated);
      }
    );
  }

  async markAllRead(actorUserId: string, idempotencyKey: string): Promise<MarkAllNotificationsReadResponse> {
    return executeIdempotently(
      this.prisma,
      actorUserId,
      'notifications-read-all',
      idempotencyKey,
      {},
      async (tx) => {
        const result = await tx.notification.updateMany({
          where: { recipientUserId: actorUserId, readAt: null },
          data: { readAt: new Date() }
        });
        return { updatedCount: result.count, unreadCount: 0 };
      }
    );
  }

  async getPreferences(actorUserId: string): Promise<NotificationPreferences> {
    const preference = await this.prisma.notificationPreference.findUnique({ where: { userId: actorUserId } });
    return toPreferences(preference ?? { locale: 'EN', emailEnabled: true, marketingEnabled: false });
  }

  async updatePreferences(
    actorUserId: string,
    input: UpdateNotificationPreferencesDto,
    idempotencyKey: string
  ): Promise<NotificationPreferences> {
    return executeIdempotently(
      this.prisma,
      actorUserId,
      'notification-preferences-update',
      idempotencyKey,
      input,
      async (tx) => {
        const preference = await tx.notificationPreference.upsert({
          where: { userId: actorUserId },
          update: input,
          create: { userId: actorUserId, ...input }
        });
        return toPreferences(preference);
      }
    );
  }
}

function toNotificationItem(notification: NotificationRecord): NotificationItem {
  return {
    ...notification,
    type: notification.type,
    payload: isStringRecord(notification.payload) ? notification.payload : {},
    readAt: notification.readAt?.toISOString() ?? null,
    createdAt: notification.createdAt.toISOString(),
    expiresAt: notification.expiresAt?.toISOString() ?? null
  };
}

function isStringRecord(value: Prisma.JsonValue): value is Record<string, string> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.values(value).every((item) => typeof item === 'string');
}

function toPreferences(preference: { locale: string; emailEnabled: boolean; marketingEnabled: boolean }): NotificationPreferences {
  return {
    locale: preference.locale === 'VI' ? 'VI' : 'EN',
    emailEnabled: preference.emailEnabled,
    marketingEnabled: preference.marketingEnabled,
    transactionalInAppEnabled: true
  };
}
