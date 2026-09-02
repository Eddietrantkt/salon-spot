import { AvailabilitySlotStatus, WorkspaceStatus } from '@prisma/client';
import { PrismaService } from '../../../common/database/prisma/prisma.service.js';
import { MediaConfigService } from '../../../common/config/media-config.service.js';
import { SearchWorkspacesService } from './search-workspaces.service.js';

describe('SearchWorkspacesService', () => {
  it('returns published workspaces with open slots for the requested local date', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        id: 'workspace_1',
        name: 'Chair A',
        coverMediaId: null,
        salon: { name: 'Salon One', area: 'D1', timezone: 'Asia/Ho_Chi_Minh' },
        rentalOptions: [{ priceCents: 250000 }],
        media: [],
        slots: [{ id: 'slot_1' }, { id: 'slot_2' }]
      }
    ]);
    const count = jest.fn().mockResolvedValue(1);
    const prisma = {
      workspace: { findMany, count },
      $transaction: jest.fn((operations: readonly Promise<unknown>[]) => Promise.all(operations))
    } as unknown as PrismaService;

    const result = await new SearchWorkspacesService(prisma, { publicBaseUrl: 'http://localhost/api/v1' } as MediaConfigService).search({ area: 'D1', date: '2026-08-24' });

    expect(result.data[0]).toMatchObject({ workspaceId: 'workspace_1', availableSlotCount: 2 });
    expect(result.meta).toEqual({ page: 1, pageSize: 20, total: 1 });
    expect(findMany.mock.calls[0][0].where).toMatchObject({
      status: WorkspaceStatus.PUBLISHED,
      slots: { some: { status: AvailabilitySlotStatus.OPEN } }
    });
  });
});
