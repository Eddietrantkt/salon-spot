import type {
  MarkAllNotificationsReadResponse,
  NotificationItem,
  NotificationPreferences,
  NotificationReadStatus,
  NotificationsResponse,
  NotificationUnreadCountResponse,
  UpdateNotificationPreferencesInput
} from '@salon-spot/contracts';
import { authenticatedGetJson, patchJson, putJson } from '../../../shared/api/http';

export function getNotifications(accessToken: string, status?: NotificationReadStatus, page = 1, pageSize = 50): Promise<NotificationsResponse> {
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (status) query.set('status', status);
  return authenticatedGetJson<NotificationsResponse>(`/me/notifications?${query.toString()}`, accessToken);
}

export function getNotificationUnreadCount(accessToken: string): Promise<NotificationUnreadCountResponse> {
  return authenticatedGetJson<NotificationUnreadCountResponse>('/me/notifications/unread-count', accessToken);
}

export function markNotificationRead(accessToken: string, notificationId: string, idempotencyKey: string): Promise<NotificationItem> {
  return putJson<NotificationItem>(`/me/notifications/${encodeURIComponent(notificationId)}/read`, {}, accessToken, idempotencyKey);
}

export function markAllNotificationsRead(accessToken: string, idempotencyKey: string): Promise<MarkAllNotificationsReadResponse> {
  return putJson<MarkAllNotificationsReadResponse>('/me/notifications/read-all', {}, accessToken, idempotencyKey);
}

export function getNotificationPreferences(accessToken: string): Promise<NotificationPreferences> {
  return authenticatedGetJson<NotificationPreferences>('/me/notification-preferences', accessToken);
}

export function updateNotificationPreferences(
  accessToken: string,
  input: UpdateNotificationPreferencesInput,
  idempotencyKey: string
): Promise<NotificationPreferences> {
  return patchJson<NotificationPreferences>('/me/notification-preferences', input, accessToken, idempotencyKey);
}
