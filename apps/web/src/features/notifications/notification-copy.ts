import type { NotificationItem } from '@salon-spot/contracts';

type Translate = (english: string, vietnamese: string) => string;

export function notificationTitle(notification: NotificationItem, t: Translate): string {
  switch (notification.type) {
    case 'BOOKING_CONFIRMED': return t('Booking confirmed', 'Lịch đặt đã được xác nhận');
    case 'BOOKING_CANCELLED': return t('Booking cancelled', 'Lịch đặt đã bị hủy');
    case 'BOOKING_COMPLETED': return t('Booking completed', 'Lịch đặt đã hoàn tất');
  }
}

export function notificationBody(notification: NotificationItem, t: Translate): string {
  const workspaceName = notification.payload.workspaceName ?? t('Workspace', 'Không gian');
  const localDate = notification.payload.localDate ?? '';
  switch (notification.type) {
    case 'BOOKING_CONFIRMED': return t(`${workspaceName} is booked for ${localDate}.`, `${workspaceName} đã được đặt cho ngày ${localDate}.`);
    case 'BOOKING_CANCELLED': return t(`The booking at ${workspaceName} for ${localDate} was cancelled.`, `Lịch đặt tại ${workspaceName} ngày ${localDate} đã bị hủy.`);
    case 'BOOKING_COMPLETED': return t(`The booking at ${workspaceName} for ${localDate} is complete.`, `Lịch đặt tại ${workspaceName} ngày ${localDate} đã hoàn tất.`);
  }
}

export function notificationTargetPath(notification: NotificationItem): string {
  const bookingId = notification.payload.bookingId
    ?? (notification.entityType === 'Booking' ? notification.entityId : undefined);
  if (bookingId) return `/bookings?${new URLSearchParams({ bookingId })}`;
  return notification.payload.recipientRole === 'OWNER' ? '/owner' : '/bookings';
}
