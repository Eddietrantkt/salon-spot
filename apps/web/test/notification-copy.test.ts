import assert from 'node:assert/strict';
import test from 'node:test';
import type { NotificationItem } from '@salon-spot/contracts';
import { notificationBody, notificationTargetPath, notificationTitle } from '../src/features/notifications/notification-copy.ts';

const notification: NotificationItem = {
  id: 'notification_1',
  type: 'BOOKING_CONFIRMED',
  titleKey: 'notifications.bookingConfirmed.title',
  bodyKey: 'notifications.bookingConfirmed.body',
  payload: { bookingId: 'booking_1', workspaceName: 'Chair One', localDate: '2026-09-10' },
  entityType: 'Booking',
  entityId: 'booking_1',
  readAt: null,
  createdAt: '2026-09-08T01:00:00.000Z',
  expiresAt: null
};

test('notification copy follows the selected presentation locale', () => {
  assert.equal(notificationTitle(notification, (english) => english), 'Booking confirmed');
  assert.match(notificationBody(notification, (_english, vietnamese) => vietnamese), /Chair One.*2026-09-10/);
});

test('notification navigation identifies the exact booking for every recipient role', () => {
  assert.equal(notificationTargetPath({ ...notification, payload: { ...notification.payload, recipientRole: 'PROFESSIONAL' } }), '/bookings?bookingId=booking_1');
  assert.equal(notificationTargetPath({ ...notification, payload: { ...notification.payload, recipientRole: 'OWNER' } }), '/bookings?bookingId=booking_1');
});
