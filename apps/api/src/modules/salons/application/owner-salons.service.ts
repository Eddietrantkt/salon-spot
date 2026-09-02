import { BadRequestException, Injectable } from '@nestjs/common';
import { MediaStatus, MembershipRole, WorkspaceStatus, type Prisma } from '@prisma/client';
import type { CreateSalonWithWorkspaceInput, CreateSalonWithWorkspaceResponse, OwnerMedia, OwnerSalon } from '@salon-spot/contracts';
import { MediaConfigService } from '../../../common/config/media-config.service.js';
import { PrismaService } from '../../../common/database/prisma/prisma.service.js';
import { executeIdempotently } from '../../../common/http/idempotency.js';

type Transaction = Prisma.TransactionClient;

const ownerSalonSelection = {
  id: true,
  name: true,
  area: true,
  timezone: true,
  coverMediaId: true,
  media: {
    where: { status: { notIn: [MediaStatus.DELETED, MediaStatus.DELETE_PENDING] } },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, status: true, contentType: true, byteSize: true, width: true, height: true, sortOrder: true, failureReason: true }
  },
  workspaces: {
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      name: true,
      status: true,
      coverMediaId: true,
      media: {
        where: { status: { notIn: [MediaStatus.DELETED, MediaStatus.DELETE_PENDING] } },
        orderBy: { sortOrder: 'asc' },
        select: { id: true, status: true, contentType: true, byteSize: true, width: true, height: true, sortOrder: true, failureReason: true }
      },
      rentalOptions: { orderBy: { createdAt: 'asc' }, select: { id: true, label: true, priceCents: true } }
    }
  }
} satisfies Prisma.SalonSelect;

/** Owns the Owner's Salon bootstrap. It creates the business boundary and its first supply record in one transaction. */
@Injectable()
export class OwnerSalonsService {
  constructor(private readonly prisma: PrismaService, private readonly mediaConfig: MediaConfigService) {}

  async createWithFirstWorkspace(
    actorUserId: string,
    input: CreateSalonWithWorkspaceInput,
    idempotencyKey: string,
    requestId?: string
  ): Promise<CreateSalonWithWorkspaceResponse> {
    this.assertTimezone(input.timezone);
    return executeIdempotently(this.prisma, actorUserId, 'owner-salon-create', idempotencyKey, input, async (tx) => {
      const createdSalon = await tx.salon.create({
        data: {
          name: input.name.trim(),
          area: input.area.trim(),
          timezone: input.timezone,
          memberships: { create: { userId: actorUserId, role: MembershipRole.OWNER } },
          workspaces: {
            create: {
              name: input.workspace.name.trim(),
              status: WorkspaceStatus.DRAFT,
              rentalOptions: {
                create: {
                  label: input.workspace.rentalLabel.trim(),
                  priceCents: input.workspace.priceCents
                }
              }
            }
          }
        },
        select: ownerSalonSelection
      });
      const workspace = createdSalon.workspaces[0];
      await tx.auditEvent.createMany({
        data: [
          { actorUserId, entityType: 'Salon', entityId: createdSalon.id, action: 'SALON_CREATED', requestId },
          { actorUserId, entityType: 'Workspace', entityId: workspace.id, action: 'WORKSPACE_CREATED', requestId }
        ]
      });
      return { salon: this.toOwnerSalon(createdSalon) };
    });
  }

  async listOwned(actorUserId: string): Promise<OwnerSalon[]> {
    const salons = await this.prisma.salon.findMany({
      where: { memberships: { some: { userId: actorUserId, role: MembershipRole.OWNER } } },
      orderBy: { createdAt: 'asc' },
      select: ownerSalonSelection
    });
    return salons.map((salon) => this.toOwnerSalon(salon));
  }

  private assertTimezone(timezone: string): void {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: timezone });
    } catch {
      throw new BadRequestException('Timezone must be a valid IANA timezone, for example Asia/Ho_Chi_Minh.');
    }
  }

  private toOwnerSalon(salon: Prisma.SalonGetPayload<{ select: typeof ownerSalonSelection }>): OwnerSalon {
    return {
      id: salon.id,
      name: salon.name,
      area: salon.area,
      timezone: salon.timezone,
      media: salon.media.map((media) => this.toOwnerMedia('salons', media, media.id === salon.coverMediaId)),
      workspaces: salon.workspaces.map((workspace) => ({
        id: workspace.id,
        name: workspace.name,
        status: workspace.status as OwnerSalon['workspaces'][number]['status'],
        rentalOptions: workspace.rentalOptions,
        media: workspace.media.map((media) => this.toOwnerMedia('workspaces', media, media.id === workspace.coverMediaId))
      }))
    };
  }

  private toOwnerMedia(
    path: 'salons' | 'workspaces',
    media: Prisma.SalonMediaGetPayload<{ select: { id: true; status: true; contentType: true; byteSize: true; width: true; height: true; sortOrder: true; failureReason: true } }>,
    isCover: boolean
  ): OwnerMedia {
    return {
      ...media,
      status: media.status as OwnerMedia['status'],
      isCover,
      url: media.status === MediaStatus.READY ? `${this.mediaConfig.publicBaseUrl}/media/${path}/${media.id}` : null
    };
  }
}
