import { Injectable } from '@nestjs/common';
import { MediaStatus, WorkspaceStatus } from '@prisma/client';
import type { CreateWorkspaceInput, CreateWorkspaceResponse } from '@salon-spot/contracts';
import { MediaConfigService } from '../../../common/config/media-config.service.js';
import { PrismaService } from '../../../common/database/prisma/prisma.service.js';
import { executeIdempotently } from '../../../common/http/idempotency.js';

/** Creates additional draft supply for an already-authorized Salon. Authorization remains in the Salon module. */
@Injectable()
export class OwnerWorkspacesService {
  constructor(private readonly prisma: PrismaService, private readonly mediaConfig: MediaConfigService) {}

  async create(
    salonId: string,
    actorUserId: string,
    input: CreateWorkspaceInput,
    idempotencyKey: string,
    requestId?: string
  ): Promise<CreateWorkspaceResponse> {
    return executeIdempotently(this.prisma, actorUserId, `owner-workspace-create:${salonId}`, idempotencyKey, input, async (tx) => {
      const workspace = await tx.workspace.create({
        data: {
          salonId,
          name: input.name.trim(),
          status: WorkspaceStatus.DRAFT,
          rentalOptions: { create: { label: input.rentalLabel.trim(), priceCents: input.priceCents } }
        },
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
      });
      await tx.auditEvent.create({
        data: { actorUserId, entityType: 'Workspace', entityId: workspace.id, action: 'WORKSPACE_CREATED', requestId }
      });
      return {
        workspace: {
          id: workspace.id,
          name: workspace.name,
          status: workspace.status,
          rentalOptions: workspace.rentalOptions,
          media: workspace.media.map((media) => ({
            ...media,
            status: media.status,
            isCover: media.id === workspace.coverMediaId,
            url: media.status === MediaStatus.READY ? `${this.mediaConfig.publicBaseUrl}/media/workspaces/${media.id}` : null
          }))
        }
      };
    });
  }
}
