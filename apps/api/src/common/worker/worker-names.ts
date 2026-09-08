export const WORKER_NAMES = ['hold-expiry', 'booking-lifecycle', 'notification-delivery', 'media-cleanup'] as const;
export type WorkerName = (typeof WORKER_NAMES)[number];
