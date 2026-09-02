import { PrismaClient, ProfessionalProfileStatus } from '@prisma/client';

const email = process.argv[2]?.trim().toLowerCase();
if (!email || !email.includes('@')) {
  console.error('Usage: pnpm --filter @salon-spot/api professional:grant -- professional@example.com');
  process.exitCode = 1;
} else {
  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true } });
    if (!user) throw new Error('The account must be registered before it can receive a Professional profile.');

    await prisma.$transaction(async (tx) => {
      const profile = await tx.professionalProfile.upsert({
        where: { userId: user.id },
        update: { status: ProfessionalProfileStatus.ACTIVE },
        create: { userId: user.id, status: ProfessionalProfileStatus.ACTIVE }
      });
      await tx.auditEvent.create({
        data: {
          entityType: 'ProfessionalProfile',
          entityId: user.id,
          action: 'PROFESSIONAL_PROFILE_ACTIVATED',
          after: { email: user.email, status: profile.status, verificationStatus: profile.verificationStatus, source: 'local-operations-cli' }
        }
      });
    });
    console.log(`Professional profile activated for ${user.email}.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Unable to activate the Professional profile.');
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}
