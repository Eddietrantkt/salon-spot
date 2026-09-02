import { Injectable, NotFoundException } from '@nestjs/common';
import { AvailabilitySlotStatus, MediaStatus, WorkspaceStatus } from '@prisma/client';
import type { PublicWorkspaceSlot, WorkspaceDetailResponse } from '@salon-spot/contracts';
import { MediaConfigService } from '../../../common/config/media-config.service.js';
import { PrismaService } from '../../../common/database/prisma/prisma.service.js';

@Injectable()
export class PublicWorkspaceDetailService {
  constructor(private readonly prisma: PrismaService, private readonly mediaConfig: MediaConfigService) {}

  async get(workspaceId: string, localDateInput: string): Promise<WorkspaceDetailResponse> {
    const localDate = new Date(`${localDateInput}T00:00:00.000Z`);
    const workspace = await this.prisma.workspace.findFirst({
      where: { id: workspaceId, status: WorkspaceStatus.PUBLISHED },
      select: {
        id: true,
        name: true,
        coverMediaId: true,
        salon: { select: { name: true, area: true, timezone: true } },
        media: {
          where: { status: MediaStatus.READY },
          orderBy: { sortOrder: 'asc' },
          select: { id: true, width: true, height: true, sortOrder: true }
        },
        slots: {
          where: { localDate, status: AvailabilitySlotStatus.OPEN, startsAt: { gt: new Date() } },
          orderBy: { startsAt: 'asc' },
          select: { id: true, startsAt: true, endsAt: true, rentalOption: { select: { label: true, priceCents: true } } }
        }
      }
    });
    if (!workspace) throw new NotFoundException('Published Workspace was not found.');

    const slots: PublicWorkspaceSlot[] = workspace.slots.map((slot) => ({
      id: slot.id,
      startsAt: slot.startsAt.toISOString(),
      endsAt: slot.endsAt.toISOString(),
      rentalOptionLabel: slot.rentalOption.label,
      priceCents: slot.rentalOption.priceCents
    }));
    return {
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      salonName: workspace.salon.name,
      area: workspace.salon.area,
      timezone: workspace.salon.timezone,
      slots,
      media: workspace.media
        .filter((media): media is typeof media & { width: number; height: number } => media.width !== null && media.height !== null)
        .map((media) => ({
          id: media.id,
          url: `${this.mediaConfig.publicBaseUrl}/media/workspaces/${media.id}`,
          width: media.width,
          height: media.height,
          sortOrder: media.sortOrder,
          isCover: media.id === workspace.coverMediaId
        }))
    };
  }
}
