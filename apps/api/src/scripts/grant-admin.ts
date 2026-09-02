import { PrismaClient } from '@prisma/client';

const email = process.argv[2]?.trim().toLowerCase();
if (!email || !email.includes('@')) {
  console.error('Usage: pnpm --filter @salon-spot/api admin:grant -- admin@example.com');
  process.exitCode = 1;
} else {
  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true } });
    if (!user) throw new Error('The account must be registered before it can receive administrator access.');
    await prisma.$transaction(async (tx) => {
      const access = await tx.adminAccess.upsert({ where: { userId: user.id }, update: {}, create: { userId: user.id } });
      await tx.auditEvent.create({
        data: {
          entityType: 'AdminAccess',
          entityId: user.id,
          action: 'ADMIN_ACCESS_GRANTED',
          after: { email: user.email, grantedAt: access.grantedAt.toISOString(), source: 'local-operations-cli' }
        }
      });
    });
    console.log(`Administrator access granted to ${user.email}.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Unable to grant administrator access.');
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}
