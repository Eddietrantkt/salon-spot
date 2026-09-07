import { BadRequestException, Injectable } from '@nestjs/common';
import { AvailabilitySlotStatus, MediaStatus, Prisma, WorkspaceStatus } from '@prisma/client';
import type { WorkspaceSearchItem, WorkspaceSearchResponse } from '@salon-spot/contracts';
import { MediaConfigService } from '../../../common/config/media-config.service.js';
import { PrismaService } from '../../../common/database/prisma/prisma.service.js';
import type { SearchWorkspacesQuery } from '../presentation/dto/search-workspaces.query.js';

const PAGE_SIZE = 20;
const MARKETPLACE_TIMEZONE = 'Asia/Ho_Chi_Minh';

/** Public read interface for workspace discovery. Prisma query details remain internal to this module. */
@Injectable()
export class SearchWorkspacesService {
  constructor(private readonly prisma: PrismaService, private readonly mediaConfig: MediaConfigService) {}

  async search(query: SearchWorkspacesQuery): Promise<WorkspaceSearchResponse> {
    if (query.date < localDateInTimezone(new Date(), MARKETPLACE_TIMEZONE)) {
      throw new BadRequestException('Search date cannot be in the past.');
    }
    const localDate = new Date(`${query.date}T00:00:00.000Z`);
    const where: Prisma.WorkspaceWhereInput = {
      status: WorkspaceStatus.PUBLISHED,
      salon: { area: query.area },
      slots: { some: { status: AvailabilitySlotStatus.OPEN, localDate } }
    };

    const [workspaces, total] = await this.prisma.$transaction([
      this.prisma.workspace.findMany({
        where,
        orderBy: { name: 'asc' },
        take: PAGE_SIZE,
        select: {
          id: true,
          name: true,
          coverMediaId: true,
          salon: { select: { name: true, area: true, timezone: true } },
          rentalOptions: { orderBy: { priceCents: 'asc' }, take: 1, select: { priceCents: true } },
          media: {
            where: { status: MediaStatus.READY },
            orderBy: { sortOrder: 'asc' },
            select: { id: true, width: true, height: true, sortOrder: true }
          },
          slots: { where: { status: AvailabilitySlotStatus.OPEN, localDate }, select: { id: true } }
        }
      }),
      this.prisma.workspace.count({ where })
    ]);

    const data: WorkspaceSearchItem[] = workspaces.map((workspace) => ({
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      salonName: workspace.salon.name,
      area: workspace.salon.area,
      timezone: workspace.salon.timezone,
      startingPriceCents: workspace.rentalOptions[0]?.priceCents ?? null,
      availableSlotCount: workspace.slots.length,
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
    }));

    return { data, meta: { page: 1, pageSize: PAGE_SIZE, total } };
  }
}

function localDateInTimezone(now: Date, timezone: string): string {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(now).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
