import { OutboxStatus, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const id = `p1recovery${Date.now()}`;

async function main(): Promise<void> {
  const event = await prisma.outboxEvent.create({
    data: {
      id,
      topic: 'BOOKING_CONFIRMED',
      payload: { fixture: 'P1_RUNTIME_RECOVERY', eventId: id },
      status: OutboxStatus.PROCESSING,
      attempts: 1,
      availableAt: new Date(Date.now() - 1_000)
    }
  });
  process.stdout.write(`${JSON.stringify({ fixture: 'P1_RUNTIME_RECOVERY', outboxId: event.id, status: event.status, attempts: event.attempts })}\n`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Unable to seed P1 runtime recovery fixture.');
  process.exitCode = 1;
}).finally(async () => prisma.$disconnect());
