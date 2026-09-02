import { Injectable, Logger } from '@nestjs/common';
import { OutboxStatus } from '@prisma/client';
import { PrismaService } from '../../../common/database/prisma/prisma.service.js';

const TOPICS = ['BOOKING_CONFIRMED', 'BOOKING_CANCELLED', 'BOOKING_COMPLETED'];
const LEASE_MS = 60_000;

/** Development adapter: records delivery in logs; a provider can replace this seam later. */
@Injectable()
export class BookingNotificationOutboxService {
  private readonly logger = new Logger(BookingNotificationOutboxService.name);

  constructor(private readonly prisma: PrismaService) {}

  async processBatch(limit = 20): Promise<number> {
    const now = new Date();
    const events = await this.prisma.outboxEvent.findMany({
      where: { topic: { in: TOPICS }, OR: [{ status: { in: [OutboxStatus.PENDING, OutboxStatus.FAILED] }, availableAt: { lte: now } }, { status: OutboxStatus.PROCESSING, availableAt: { lte: now } }] },
      orderBy: { createdAt: 'asc' }, take: limit
    });
    let delivered = 0;
    for (const event of events) {
      const leaseExpiresAt = new Date(now.getTime() + LEASE_MS);
      const claimed = await this.prisma.outboxEvent.updateMany({
        where: { id: event.id, OR: [{ status: { in: [OutboxStatus.PENDING, OutboxStatus.FAILED] }, availableAt: { lte: now } }, { status: OutboxStatus.PROCESSING, availableAt: { lte: now } }] },
        data: { status: OutboxStatus.PROCESSING, attempts: { increment: 1 }, availableAt: leaseExpiresAt }
      });
      if (claimed.count !== 1) continue;
      try {
        this.logger.log(`Notification sink accepted ${event.topic} for outbox ${event.id}.`);
        const done = await this.prisma.outboxEvent.updateMany({ where: { id: event.id, status: OutboxStatus.PROCESSING, availableAt: leaseExpiresAt }, data: { status: OutboxStatus.DELIVERED } });
        if (done.count === 1) delivered += 1;
      } catch (error) {
        const delay = Math.min(300, 2 ** Math.min(event.attempts + 1, 8));
        await this.prisma.outboxEvent.updateMany({ where: { id: event.id, status: OutboxStatus.PROCESSING, availableAt: leaseExpiresAt }, data: { status: OutboxStatus.FAILED, availableAt: new Date(Date.now() + delay * 1_000) } });
      }
    }
    return delivered;
  }
}
