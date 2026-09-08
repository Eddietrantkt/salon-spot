import { Body, Controller, Get, Headers, Param, Patch, Put, Query, UseGuards } from '@nestjs/common';
import type {
  AuthenticatedUser,
  MarkAllNotificationsReadResponse,
  NotificationItem,
  NotificationPreferences,
  NotificationsResponse,
  NotificationUnreadCountResponse
} from '@salon-spot/contracts';
import { requireIdempotencyKey } from '../../../common/http/idempotency.js';
import { AccessTokenGuard } from '../../auth/presentation/access-token.guard.js';
import { CurrentUser } from '../../auth/presentation/current-user.decorator.js';
import { NotificationsService } from '../application/notifications.service.js';
import { NotificationQueryDto } from './dto/notification-query.dto.js';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto.js';

@Controller('me')
@UseGuards(AccessTokenGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get('notifications')
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: NotificationQueryDto): Promise<NotificationsResponse> {
    return this.notifications.listMine(user.id, query);
  }

  @Get('notifications/unread-count')
  unreadCount(@CurrentUser() user: AuthenticatedUser): Promise<NotificationUnreadCountResponse> {
    return this.notifications.unreadCount(user.id);
  }

  @Put('notifications/read-all')
  markAllRead(
    @CurrentUser() user: AuthenticatedUser,
    @Headers('idempotency-key') idempotencyKey: string | string[] | undefined
  ): Promise<MarkAllNotificationsReadResponse> {
    return this.notifications.markAllRead(user.id, requireIdempotencyKey(idempotencyKey));
  }

  @Put('notifications/:notificationId/read')
  markRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('notificationId') notificationId: string,
    @Headers('idempotency-key') idempotencyKey: string | string[] | undefined
  ): Promise<NotificationItem> {
    return this.notifications.markRead(user.id, notificationId, requireIdempotencyKey(idempotencyKey));
  }

  @Get('notification-preferences')
  preferences(@CurrentUser() user: AuthenticatedUser): Promise<NotificationPreferences> {
    return this.notifications.getPreferences(user.id);
  }

  @Patch('notification-preferences')
  updatePreferences(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: UpdateNotificationPreferencesDto,
    @Headers('idempotency-key') idempotencyKey: string | string[] | undefined
  ): Promise<NotificationPreferences> {
    return this.notifications.updatePreferences(user.id, body, requireIdempotencyKey(idempotencyKey));
  }
}
