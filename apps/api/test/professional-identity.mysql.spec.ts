import {
  MembershipRole,
  ProfessionalCredentialReviewStatus,
  ProfessionalCredentialType,
  ProfessionalDocumentStatus,
  ProfessionalDocumentType,
  ProfessionalProfileStatus,
  ProfessionalVerificationStatus
} from '@prisma/client';
import { PrismaService } from '../src/common/database/prisma/prisma.service.js';

const describeMySql = process.env.RUN_MYSQL_E2E === '1' ? describe : describe.skip;

describeMySql('Professional identity foundation on MySQL', () => {
  const prisma = new PrismaService();
  const suffix = `${Date.now()}`;
  const ownerId = `idown${suffix}`;
  const professionalId = `idpro${suffix}`;
  const salonId = `idsal${suffix}`;
  const caseId = `idcase${suffix}`;
  const credentialId = `idcred${suffix}`;
  const documentId = `iddoc${suffix}`;

  beforeAll(async () => {
    await prisma.$connect();
    await prisma.user.createMany({
      data: [
        { id: ownerId, email: `identity-owner-${suffix}@example.test`, displayName: 'Identity Owner', passwordHash: '!integration-test-only!' },
        { id: professionalId, email: `identity-professional-${suffix}@example.test`, displayName: 'Identity Professional', passwordHash: '!integration-test-only!' }
      ]
    });
    await prisma.salon.create({ data: { id: salonId, name: 'Identity Test Salon', area: 'Test Area', timezone: 'Asia/Ho_Chi_Minh' } });
    await prisma.salonMembership.create({ data: { salonId, userId: ownerId, role: MembershipRole.OWNER } });
    await prisma.professionalProfile.create({
      data: { userId: professionalId, status: ProfessionalProfileStatus.ACTIVE, verificationStatus: ProfessionalVerificationStatus.APPROVED }
    });
    await prisma.professionalVerificationCase.create({
      data: { id: caseId, professionalUserId: professionalId, status: ProfessionalVerificationStatus.APPROVED, submittedAt: new Date(), reviewedAt: new Date() }
    });
    await prisma.professionalCredential.create({
      data: {
        id: credentialId,
        verificationCaseId: caseId,
        professionalUserId: professionalId,
        type: ProfessionalCredentialType.LICENSE,
        referenceNumber: `LICENSE-${suffix}`,
        jurisdiction: 'US-CA',
        expiresAt: new Date('2099-12-31T00:00:00.000Z'),
        reviewStatus: ProfessionalCredentialReviewStatus.VERIFIED,
        reviewedAt: new Date()
      }
    });
    await prisma.professionalDocument.create({
      data: {
        id: documentId,
        verificationCaseId: caseId,
        professionalUserId: professionalId,
        credentialId,
        type: ProfessionalDocumentType.LICENSE,
        storageKey: `private/professionals/${professionalId}/${documentId}.pdf`,
        contentType: 'application/pdf',
        byteSize: 512,
        checksumSha256: 'c'.repeat(64),
        status: ProfessionalDocumentStatus.READY
      }
    });
  });

  afterAll(async () => {
    await prisma.passwordResetToken.deleteMany({ where: { userId: { in: [ownerId, professionalId] } } });
    await prisma.professionalDocument.deleteMany({ where: { professionalUserId: professionalId } });
    await prisma.professionalCredential.deleteMany({ where: { professionalUserId: professionalId } });
    await prisma.professionalVerificationCase.deleteMany({ where: { professionalUserId: professionalId } });
    await prisma.salon.deleteMany({ where: { id: salonId } });
    await prisma.user.deleteMany({ where: { id: { in: [ownerId, professionalId] } } });
    await prisma.$disconnect();
  });

  it('stores password recovery tokens at User scope for both Owner and Professional identities', async () => {
    await prisma.passwordResetToken.createMany({
      data: [
        { userId: ownerId, tokenHash: 'a'.repeat(64), expiresAt: new Date(Date.now() + 15 * 60_000) },
        { userId: professionalId, tokenHash: 'b'.repeat(64), expiresAt: new Date(Date.now() + 15 * 60_000) }
      ]
    });

    await expect(prisma.passwordResetToken.count({ where: { userId: { in: [ownerId, professionalId] }, usedAt: null } })).resolves.toBe(2);
  });

  it('persists structured credential validity separately from private document evidence', async () => {
    const verification = await prisma.professionalVerificationCase.findUniqueOrThrow({
      where: { id: caseId },
      include: { credentials: true, documents: true }
    });

    expect(verification.status).toBe(ProfessionalVerificationStatus.APPROVED);
    expect(verification.credentials).toEqual([expect.objectContaining({ type: ProfessionalCredentialType.LICENSE, reviewStatus: ProfessionalCredentialReviewStatus.VERIFIED })]);
    expect(verification.documents).toEqual([expect.objectContaining({ type: ProfessionalDocumentType.LICENSE, status: ProfessionalDocumentStatus.READY, storageKey: expect.stringMatching(/^private\//) })]);
  });

  it('rejects evidence whose case and Professional identity do not match', async () => {
    await expect(prisma.professionalDocument.create({
      data: {
        verificationCaseId: caseId,
        professionalUserId: ownerId,
        type: ProfessionalDocumentType.IDENTITY,
        storageKey: `private/professionals/${ownerId}/mismatch.pdf`,
        contentType: 'application/pdf'
      }
    })).rejects.toMatchObject({ code: 'P2003' });
  });
});
