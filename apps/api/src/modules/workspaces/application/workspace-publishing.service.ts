import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { MediaStatus, Prisma, WorkspaceStatus } from '@prisma/client';
import type { CreateWorkspaceResponse, OwnerMedia, WorkspacePublishChecklistResponse } from '@salon-spot/contracts';
import { MediaConfigService } from '../../../common/config/media-config.service.js';
import { PrismaService } from '../../../common/database/prisma/prisma.service.js';

const publishSelection = {
  id: true,
  salonId: true,
  name: true,
  status: true,
  coverMediaId: true,
  salon: { select: { name: true, area: true, timezone: true } },
  rentalOptions: { orderBy: { createdAt: 'asc' }, select: { id: true, label: true, priceCents: true } },
  media: {
    where: { status: { notIn: [MediaStatus.DELETED, MediaStatus.DELETE_PENDING] } },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, status: true, contentType: true, byteSize: true, width: true, height: true, sortOrder: true, failureReason: true }
  }
} satisfies Prisma.WorkspaceSelect;

type PublishWorkspace = Prisma.WorkspaceGetPayload<{ select: typeof publishSelection }>;

@Injectable()
export class WorkspacePublishingService {
  constructor(private readonly prisma: PrismaService, private readonly mediaConfig: MediaConfigService) {}

  async checklist(salonId: string, workspaceId: string): Promise<WorkspacePublishChecklistResponse> {
    const workspace = await this.getWorkspace(this.prisma, salonId, workspaceId);
    return this.buildChecklist(workspace);
  }

  async publish(salonId: string, workspaceId: string, actorUserId: string, requestId?: string): Promise<CreateWorkspaceResponse> {
    const workspace = await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT id FROM Workspace WHERE id = ${workspaceId} AND salonId = ${salonId} FOR UPDATE
      `);
      if (rows.length !== 1) throw new NotFoundException('Workspace was not found in this Salon.');

      const current = await this.getWorkspace(tx, salonId, workspaceId);
      const checklist = this.buildChecklist(current);
      if (!checklist.eligible) {
        const reasons = checklist.checks.filter((check) => !check.passed).map((check) => check.message).join(' ');
        throw new BadRequestException(`Publish checklist failed. ${reasons}`);
      }
      if (current.status === WorkspaceStatus.PUBLISHED) return current;

      const updated = await tx.workspace.update({
        where: { id: workspaceId },
        data: { status: WorkspaceStatus.PUBLISHED },
        select: publishSelection
      });
      await tx.auditEvent.create({
        data: {
          actorUserId,
          entityType: 'Workspace',
          entityId: workspaceId,
          action: 'WORKSPACE_PUBLISHED',
          requestId,
          before: { status: current.status },
          after: { status: WorkspaceStatus.PUBLISHED }
        }
      });
      return updated;
    });
    return { workspace: this.toOwnerWorkspace(workspace) };
  }

  private async getWorkspace(
    client: PrismaService | Prisma.TransactionClient,
    salonId: string,
    workspaceId: string
  ): Promise<PublishWorkspace> {
    const workspace = await client.workspace.findFirst({ where: { id: workspaceId, salonId }, select: publishSelection });
    if (!workspace) throw new NotFoundException('Workspace was not found in this Salon.');
    return workspace;
  }

  private buildChecklist(workspace: PublishWorkspace): WorkspacePublishChecklistResponse {
    const checks: WorkspacePublishChecklistResponse['checks'] = [
      {
        code: 'SALON_DETAILS',
        passed: Boolean(workspace.salon.name.trim() && workspace.salon.area.trim() && workspace.salon.timezone.trim()),
        message: 'Salon must have a name, area and timezone.'
      },
      {
        code: 'WORKSPACE_NAME',
        passed: Boolean(workspace.name.trim()),
        message: 'Workspace must have a name.'
      },
      {
        code: 'RENTAL_OPTION',
        passed: workspace.rentalOptions.some((option) => option.label.trim().length > 0 && option.priceCents > 0),
        message: 'Workspace must have at least one valid RentalOption with a positive price.'
      },
      {
        code: 'MEDIA_PROCESSING',
        passed: !workspace.media.some((media) => media.status === MediaStatus.PENDING_UPLOAD || media.status === MediaStatus.PROCESSING),
        message: 'Finish or delete pending media before publishing.'
      }
    ];
    return { eligible: checks.every((check) => check.passed), checks };
  }

  private toOwnerWorkspace(workspace: PublishWorkspace): CreateWorkspaceResponse['workspace'] {
    return {
      id: workspace.id,
      name: workspace.name,
      status: workspace.status,
      rentalOptions: workspace.rentalOptions,
      media: workspace.media.map((media): OwnerMedia => ({
        ...media,
        status: media.status,
        isCover: media.id === workspace.coverMediaId,
        url: media.status === MediaStatus.READY ? `${this.mediaConfig.publicBaseUrl}/media/workspaces/${media.id}` : null
      }))
    };
  }
}
