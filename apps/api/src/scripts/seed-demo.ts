import {
  AdminPermissionKind,
  AvailabilitySlotStatus,
  BookingStatus,
  MediaStatus,
  MembershipRole,
  ProfessionalCredentialReviewStatus,
  ProfessionalCredentialType,
  ProfessionalProfileStatus,
  ProfessionalVerificationStatus,
  PrismaClient,
  WorkspaceStatus
} from '@prisma/client';
import { createHash, randomBytes, scrypt } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { promisify } from 'node:util';
import sharp from 'sharp';

const scryptAsync = promisify(scrypt);
const PASSWORD = 'SalonDemo#2026';
const TIMEZONE = 'Asia/Ho_Chi_Minh';
const KEY_LENGTH = 64;

const ids = {
  salonD1: 'demo_salon_d1',
  salonD3: 'demo_salon_d3',
  chair: 'demo_ws_chair',
  privateStudio: 'demo_ws_private',
  d3Studio: 'demo_ws_d3',
  draft: 'demo_ws_draft',
  chairOption: 'demo_option_chair',
  privateOption: 'demo_option_private',
  d3Option: 'demo_option_d3',
  chairMedia: 'demo_media_chair',
  privateMedia: 'demo_media_private',
  d3Media: 'demo_media_d3',
  professionalVerification: 'demo_pro_verification',
  professionalLicense: 'demo_pro_license',
  professionalInsurance: 'demo_pro_insurance',
  upcomingBooking: 'demo_booking_upcoming',
  cancelledBooking: 'demo_booking_cancelled',
  completedBooking: 'demo_booking_completed'
} as const;

interface DemoImage {
  mediaId: string;
  workspaceId: string;
  storageKey: string;
  byteSize: number;
  checksumSha256: string;
  width: number;
  height: number;
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const images = await writeDemoImages();
    const passwordHashes = await Promise.all([hashPassword(PASSWORD), hashPassword(PASSWORD), hashPassword(PASSWORD)]);
    const dates = upcomingLocalDates(7);

    await prisma.$transaction(async (tx) => {
      const [owner, admin, professional] = await Promise.all([
        tx.user.upsert({
          where: { email: 'owner.demo@salonspot.local' },
          update: { displayName: 'Linh Nguyen — Owner Demo', passwordHash: passwordHashes[0], status: 'ACTIVE' },
          create: { email: 'owner.demo@salonspot.local', displayName: 'Linh Nguyen — Owner Demo', passwordHash: passwordHashes[0] }
        }),
        tx.user.upsert({
          where: { email: 'admin.demo@salonspot.local' },
          update: { displayName: 'Minh Tran — Admin Demo', passwordHash: passwordHashes[1], status: 'ACTIVE' },
          create: { email: 'admin.demo@salonspot.local', displayName: 'Minh Tran — Admin Demo', passwordHash: passwordHashes[1] }
        }),
        tx.user.upsert({
          where: { email: 'professional.demo@salonspot.local' },
          update: { displayName: 'Ha Pham — Professional Demo', passwordHash: passwordHashes[2], status: 'ACTIVE' },
          create: { email: 'professional.demo@salonspot.local', displayName: 'Ha Pham — Professional Demo', passwordHash: passwordHashes[2] }
        })
      ]);

      await tx.adminAccess.upsert({ where: { userId: admin.id }, update: {}, create: { userId: admin.id } });
      await tx.adminPermission.upsert({
        where: { userId_permission: { userId: admin.id, permission: AdminPermissionKind.VERIFY_PROFESSIONAL } },
        update: {},
        create: { userId: admin.id, permission: AdminPermissionKind.VERIFY_PROFESSIONAL }
      });
      await tx.professionalProfile.upsert({
        where: { userId: professional.id },
        update: { status: ProfessionalProfileStatus.ACTIVE, verificationStatus: ProfessionalVerificationStatus.APPROVED },
        create: { userId: professional.id, status: ProfessionalProfileStatus.ACTIVE, verificationStatus: ProfessionalVerificationStatus.APPROVED }
      });
      await tx.professionalVerificationCase.upsert({
        where: { id: ids.professionalVerification },
        update: { professionalUserId: professional.id, status: ProfessionalVerificationStatus.APPROVED, submittedAt: new Date(), reviewedAt: new Date(), reviewerUserId: admin.id, reasonCode: null, reasonDetail: null },
        create: { id: ids.professionalVerification, professionalUserId: professional.id, status: ProfessionalVerificationStatus.APPROVED, submittedAt: new Date(), reviewedAt: new Date(), reviewerUserId: admin.id }
      });
      await Promise.all([
        tx.professionalCredential.upsert({
          where: { id: ids.professionalLicense },
          update: { verificationCaseId: ids.professionalVerification, professionalUserId: professional.id, type: ProfessionalCredentialType.LICENSE, referenceNumber: 'DEMO-CA-COSMO-2026', issuingAuthority: 'Demo California Board', jurisdiction: 'US-CA', expiresAt: dateOnly('2099-12-31'), reviewStatus: ProfessionalCredentialReviewStatus.VERIFIED, reviewedAt: new Date(), revokedAt: null, supersededAt: null },
          create: { id: ids.professionalLicense, verificationCaseId: ids.professionalVerification, professionalUserId: professional.id, type: ProfessionalCredentialType.LICENSE, referenceNumber: 'DEMO-CA-COSMO-2026', issuingAuthority: 'Demo California Board', jurisdiction: 'US-CA', expiresAt: dateOnly('2099-12-31'), reviewStatus: ProfessionalCredentialReviewStatus.VERIFIED, reviewedAt: new Date() }
        }),
        tx.professionalCredential.upsert({
          where: { id: ids.professionalInsurance },
          update: { verificationCaseId: ids.professionalVerification, professionalUserId: professional.id, type: ProfessionalCredentialType.INSURANCE, referenceNumber: 'DEMO-POLICY-2026', issuingAuthority: 'Demo Insurance Provider', jurisdiction: 'US-CA', expiresAt: dateOnly('2099-12-31'), reviewStatus: ProfessionalCredentialReviewStatus.VERIFIED, reviewedAt: new Date(), revokedAt: null, supersededAt: null },
          create: { id: ids.professionalInsurance, verificationCaseId: ids.professionalVerification, professionalUserId: professional.id, type: ProfessionalCredentialType.INSURANCE, referenceNumber: 'DEMO-POLICY-2026', issuingAuthority: 'Demo Insurance Provider', jurisdiction: 'US-CA', expiresAt: dateOnly('2099-12-31'), reviewStatus: ProfessionalCredentialReviewStatus.VERIFIED, reviewedAt: new Date() }
        })
      ]);

      await Promise.all([
        tx.salon.upsert({ where: { id: ids.salonD1 }, update: { name: 'Lumière Hair Collective', area: 'D1', timezone: TIMEZONE }, create: { id: ids.salonD1, name: 'Lumière Hair Collective', area: 'D1', timezone: TIMEZONE } }),
        tx.salon.upsert({ where: { id: ids.salonD3 }, update: { name: 'Atelier Tóc & Beauty', area: 'D3', timezone: TIMEZONE }, create: { id: ids.salonD3, name: 'Atelier Tóc & Beauty', area: 'D3', timezone: TIMEZONE } })
      ]);

      await Promise.all([
        tx.salonMembership.upsert({ where: { salonId_userId: { salonId: ids.salonD1, userId: owner.id } }, update: { role: MembershipRole.OWNER }, create: { salonId: ids.salonD1, userId: owner.id, role: MembershipRole.OWNER } }),
        tx.salonMembership.upsert({ where: { salonId_userId: { salonId: ids.salonD3, userId: owner.id } }, update: { role: MembershipRole.OWNER }, create: { salonId: ids.salonD3, userId: owner.id, role: MembershipRole.OWNER } })
      ]);

      await Promise.all([
        tx.workspace.upsert({ where: { id: ids.chair }, update: { salonId: ids.salonD1, name: 'Ghế tạo mẫu No. 01', status: WorkspaceStatus.PUBLISHED }, create: { id: ids.chair, salonId: ids.salonD1, name: 'Ghế tạo mẫu No. 01', status: WorkspaceStatus.PUBLISHED } }),
        tx.workspace.upsert({ where: { id: ids.privateStudio }, update: { salonId: ids.salonD1, name: 'Private Styling Studio', status: WorkspaceStatus.PUBLISHED }, create: { id: ids.privateStudio, salonId: ids.salonD1, name: 'Private Styling Studio', status: WorkspaceStatus.PUBLISHED } }),
        tx.workspace.upsert({ where: { id: ids.d3Studio }, update: { salonId: ids.salonD3, name: 'Beauty Corner District 3', status: WorkspaceStatus.PUBLISHED }, create: { id: ids.d3Studio, salonId: ids.salonD3, name: 'Beauty Corner District 3', status: WorkspaceStatus.PUBLISHED } }),
        tx.workspace.upsert({ where: { id: ids.draft }, update: { salonId: ids.salonD1, name: 'Khu thử nghiệm — chưa công khai', status: WorkspaceStatus.DRAFT }, create: { id: ids.draft, salonId: ids.salonD1, name: 'Khu thử nghiệm — chưa công khai', status: WorkspaceStatus.DRAFT } })
      ]);

      await Promise.all([
        tx.rentalOption.upsert({ where: { id_workspaceId: { id: ids.chairOption, workspaceId: ids.chair } }, update: { label: 'Ca tạo mẫu 2 giờ', priceCents: 280000 }, create: { id: ids.chairOption, workspaceId: ids.chair, label: 'Ca tạo mẫu 2 giờ', priceCents: 280000 } }),
        tx.rentalOption.upsert({ where: { id_workspaceId: { id: ids.privateOption, workspaceId: ids.privateStudio } }, update: { label: 'Studio riêng 2 giờ', priceCents: 450000 }, create: { id: ids.privateOption, workspaceId: ids.privateStudio, label: 'Studio riêng 2 giờ', priceCents: 450000 } }),
        tx.rentalOption.upsert({ where: { id_workspaceId: { id: ids.d3Option, workspaceId: ids.d3Studio } }, update: { label: 'Góc beauty 2 giờ', priceCents: 320000 }, create: { id: ids.d3Option, workspaceId: ids.d3Studio, label: 'Góc beauty 2 giờ', priceCents: 320000 } })
      ]);

      for (const image of images) {
        await tx.workspaceMedia.upsert({
          where: { id: image.mediaId },
          update: { workspaceId: image.workspaceId, storageKey: image.storageKey, contentType: 'image/png', byteSize: image.byteSize, checksumSha256: image.checksumSha256, width: image.width, height: image.height, status: MediaStatus.READY, sortOrder: 0, failureReason: null, uploadExpiresAt: null },
          create: { id: image.mediaId, workspaceId: image.workspaceId, storageKey: image.storageKey, contentType: 'image/png', byteSize: image.byteSize, checksumSha256: image.checksumSha256, width: image.width, height: image.height, status: MediaStatus.READY, sortOrder: 0 }
        });
        await tx.workspace.update({ where: { id: image.workspaceId }, data: { coverMediaId: image.mediaId } });
      }

      const slotPlans = createSlotPlans(dates);
      for (const slot of slotPlans) {
        await tx.workspaceCalendarLock.upsert({ where: { workspaceId_localDate: { workspaceId: slot.workspaceId, localDate: slot.localDate } }, update: {}, create: { workspaceId: slot.workspaceId, localDate: slot.localDate } });
        await tx.availabilitySlot.upsert({
          where: { id: slot.id },
          update: { workspaceId: slot.workspaceId, rentalOptionId: slot.rentalOptionId, startsAt: slot.startsAt, endsAt: slot.endsAt, localDate: slot.localDate, status: slot.status },
          create: slot
        });
      }

      const upcomingSlot = slotPlans.find((slot) => slot.id === 'demo_private_3_3')!;
      const cancelledSlot = slotPlans.find((slot) => slot.id === 'demo_chair_4_0')!;
      await tx.booking.upsert({
        where: { id: ids.upcomingBooking },
        update: { availabilitySlotId: upcomingSlot.id, professionalUserId: professional.id, status: BookingStatus.CONFIRMED, workspaceName: 'Private Styling Studio', rentalOptionLabel: 'Studio riêng 2 giờ', priceCents: 450000, startsAt: upcomingSlot.startsAt, endsAt: upcomingSlot.endsAt, salonTimezone: TIMEZONE, localDate: upcomingSlot.localDate, cancelledAt: null, completedAt: null },
        create: { id: ids.upcomingBooking, availabilitySlotId: upcomingSlot.id, professionalUserId: professional.id, status: BookingStatus.CONFIRMED, workspaceName: 'Private Styling Studio', rentalOptionLabel: 'Studio riêng 2 giờ', priceCents: 450000, startsAt: upcomingSlot.startsAt, endsAt: upcomingSlot.endsAt, salonTimezone: TIMEZONE, localDate: upcomingSlot.localDate }
      });
      await tx.booking.upsert({
        where: { id: ids.cancelledBooking },
        update: { availabilitySlotId: cancelledSlot.id, professionalUserId: professional.id, status: BookingStatus.CANCELLED, workspaceName: 'Ghế tạo mẫu No. 01', rentalOptionLabel: 'Ca tạo mẫu 2 giờ', priceCents: 280000, startsAt: cancelledSlot.startsAt, endsAt: cancelledSlot.endsAt, salonTimezone: TIMEZONE, localDate: cancelledSlot.localDate, cancelledAt: new Date(), completedAt: null },
        create: { id: ids.cancelledBooking, availabilitySlotId: cancelledSlot.id, professionalUserId: professional.id, status: BookingStatus.CANCELLED, workspaceName: 'Ghế tạo mẫu No. 01', rentalOptionLabel: 'Ca tạo mẫu 2 giờ', priceCents: 280000, startsAt: cancelledSlot.startsAt, endsAt: cancelledSlot.endsAt, salonTimezone: TIMEZONE, localDate: cancelledSlot.localDate, cancelledAt: new Date() }
      });

      const completed = completedBookingPlan();
      await tx.workspaceCalendarLock.upsert({ where: { workspaceId_localDate: { workspaceId: completed.workspaceId, localDate: completed.localDate } }, update: {}, create: { workspaceId: completed.workspaceId, localDate: completed.localDate } });
      await tx.availabilitySlot.upsert({ where: { id: completed.id }, update: { workspaceId: completed.workspaceId, rentalOptionId: completed.rentalOptionId, startsAt: completed.startsAt, endsAt: completed.endsAt, localDate: completed.localDate, status: AvailabilitySlotStatus.BOOKED }, create: completed });
      await tx.booking.upsert({
        where: { id: ids.completedBooking },
        update: { availabilitySlotId: completed.id, professionalUserId: professional.id, status: BookingStatus.COMPLETED, workspaceName: 'Ghế tạo mẫu No. 01', rentalOptionLabel: 'Ca tạo mẫu 2 giờ', priceCents: 280000, startsAt: completed.startsAt, endsAt: completed.endsAt, salonTimezone: TIMEZONE, localDate: completed.localDate, cancelledAt: null, completedAt: new Date() },
        create: { id: ids.completedBooking, availabilitySlotId: completed.id, professionalUserId: professional.id, status: BookingStatus.COMPLETED, workspaceName: 'Ghế tạo mẫu No. 01', rentalOptionLabel: 'Ca tạo mẫu 2 giờ', priceCents: 280000, startsAt: completed.startsAt, endsAt: completed.endsAt, salonTimezone: TIMEZONE, localDate: completed.localDate, completedAt: new Date() }
      });

      await tx.auditEvent.deleteMany({ where: { entityType: 'DemoSeed', entityId: 'salon-spot-local-demo', action: 'DEMO_DATA_SEEDED' } });
      await tx.auditEvent.create({ data: { actorUserId: admin.id, entityType: 'DemoSeed', entityId: 'salon-spot-local-demo', action: 'DEMO_DATA_SEEDED', after: { areas: ['D1', 'D3'], daysSeeded: dates.length, workspaceCount: 4, source: 'local-demo-seed' } } });
    });

    console.log('Demo data is ready.');
    console.log('Owner: owner.demo@salonspot.local / SalonDemo#2026');
    console.log('Admin: admin.demo@salonspot.local / SalonDemo#2026');
    console.log('Professional: professional.demo@salonspot.local / SalonDemo#2026');
    console.log(`Discovery is populated for D1 and D3 from ${dates[0]} through ${dates.at(-1)}.`);
  } finally {
    await prisma.$disconnect();
  }
}

function createSlotPlans(dates: string[]): Array<{ id: string; workspaceId: string; rentalOptionId: string; startsAt: Date; endsAt: Date; localDate: Date; status: AvailabilitySlotStatus }> {
  const configurations = [
    { prefix: 'demo_chair', workspaceId: ids.chair, rentalOptionId: ids.chairOption, availablePeriods: [0, 1, 2, 3] },
    { prefix: 'demo_private', workspaceId: ids.privateStudio, rentalOptionId: ids.privateOption, availablePeriods: [0, 1] },
    { prefix: 'demo_d3', workspaceId: ids.d3Studio, rentalOptionId: ids.d3Option, availablePeriods: [1, 2, 3] }
  ];
  const periods = [[9, 11], [11, 13], [13, 15], [15, 17]] as const;
  return dates.flatMap((date, dayIndex) => configurations.flatMap((configuration) => periods.map(([startHour, endHour], periodIndex) => ({
    id: `${configuration.prefix}_${dayIndex}_${periodIndex}`,
    workspaceId: configuration.workspaceId,
    rentalOptionId: configuration.rentalOptionId,
    startsAt: vietnamInstant(date, startHour),
    endsAt: vietnamInstant(date, endHour),
    localDate: dateOnly(date),
    status: configuration.prefix === 'demo_private' && dayIndex === 3 && periodIndex === 3
      ? AvailabilitySlotStatus.BOOKED
      : configuration.availablePeriods.includes(periodIndex) ? AvailabilitySlotStatus.OPEN : AvailabilitySlotStatus.BLOCKED
  }))));
}

function completedBookingPlan(): { id: string; workspaceId: string; rentalOptionId: string; startsAt: Date; endsAt: Date; localDate: Date; status: AvailabilitySlotStatus } {
  const past = new Date();
  past.setDate(past.getDate() - 2);
  const date = dateInTimezone(past);
  return { id: 'demo_completed_slot', workspaceId: ids.chair, rentalOptionId: ids.chairOption, startsAt: vietnamInstant(date, 9), endsAt: vietnamInstant(date, 11), localDate: dateOnly(date), status: AvailabilitySlotStatus.BOOKED };
}

async function writeDemoImages(): Promise<DemoImage[]> {
  const root = await mediaStorageRoot();
  const themes = [
    { mediaId: ids.chairMedia, workspaceId: ids.chair, colorA: '#c88957', colorB: '#432418', title: 'STYLING CHAIR' },
    { mediaId: ids.privateMedia, workspaceId: ids.privateStudio, colorA: '#836650', colorB: '#211918', title: 'PRIVATE STUDIO' },
    { mediaId: ids.d3Media, workspaceId: ids.d3Studio, colorA: '#ad7a61', colorB: '#3f2620', title: 'BEAUTY CORNER' }
  ];
  return Promise.all(themes.map(async (theme) => {
    const storageKey = `ready/workspaces/${theme.workspaceId}/demo-cover.png`;
    const buffer = await sharp(Buffer.from(demoSvg(theme.colorA, theme.colorB, theme.title))).png().toBuffer();
    const target = resolve(root, storageKey);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, buffer);
    return { mediaId: theme.mediaId, workspaceId: theme.workspaceId, storageKey, byteSize: buffer.length, checksumSha256: createHash('sha256').update(buffer).digest('hex'), width: 1200, height: 800 };
  }));
}

function demoSvg(colorA: string, colorB: string, title: string): string {
  return `<svg width="1200" height="800" viewBox="0 0 1200 800" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${colorA}"/><stop offset="1" stop-color="${colorB}"/></linearGradient></defs><rect width="1200" height="800" fill="url(#bg)"/><circle cx="930" cy="250" r="240" fill="#fff" fill-opacity=".12"/><rect x="110" y="120" width="510" height="540" rx="255" fill="#17120f" fill-opacity=".22"/><path d="M290 555c0-160 130-290 290-290v290H290Z" fill="#f4e5d3" fill-opacity=".88"/><path d="M385 555V345h185c0 116-82 210-185 210Z" fill="#2e211b" fill-opacity=".64"/><text x="110" y="710" fill="#fff8ef" font-family="serif" font-size="45" letter-spacing="6">${title}</text><text x="114" y="752" fill="#fff8ef" fill-opacity=".78" font-family="sans-serif" font-size="19" letter-spacing="4">THE SALON SPOT · DEMO</text></svg>`;
}

async function mediaStorageRoot(): Promise<string> {
  const fromEnvironment = process.env.MEDIA_STORAGE_ROOT;
  if (fromEnvironment) return resolve(fromEnvironment);
  const envPath = resolve(process.cwd(), '.env');
  const content = await readFile(envPath, 'utf8').catch(() => '');
  const match = content.match(/^MEDIA_STORAGE_ROOT\s*=\s*"?([^"\r\n]+)"?\s*$/m);
  return resolve(match?.[1]?.trim() || '.data/media');
}

function upcomingLocalDates(count: number): string[] {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() + index + 1);
    return dateInTimezone(date);
  });
}

function dateInTimezone(date: Date): string {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(date).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function dateOnly(date: string): Date { return new Date(`${date}T00:00:00.000Z`); }

function vietnamInstant(date: string, hour: number): Date { return new Date(`${date}T${String(hour).padStart(2, '0')}:00:00.000+07:00`); }

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('base64url');
  const derived = await scryptAsync(password, salt, KEY_LENGTH) as Buffer;
  return `scrypt$${salt}$${derived.toString('base64url')}`;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Unable to seed demo data.');
  process.exitCode = 1;
});
