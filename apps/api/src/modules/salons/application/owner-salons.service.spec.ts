import { MembershipRole, WorkspaceStatus } from '@prisma/client';
import { PrismaService } from '../../../common/database/prisma/prisma.service.js';
import { MediaConfigService } from '../../../common/config/media-config.service.js';
import { OwnerSalonsService } from './owner-salons.service.js';

describe('OwnerSalonsService', () => {
  it('creates the Salon, OWNER membership, first draft Workspace and audit trail in one transaction', async () => {
    const created = {
      id: 'salon_1', name: 'Luna Salon', area: 'D1', timezone: 'Asia/Ho_Chi_Minh', coverMediaId: null, media: [],
      workspaces: [{ id: 'workspace_1', name: 'Chair A', status: WorkspaceStatus.DRAFT, coverMediaId: null, media: [], rentalOptions: [{ id: 'option_1', label: '2 giờ', priceCents: 250000 }] }]
    };
    const tx = { salon: { create: jest.fn().mockResolvedValue(created) }, auditEvent: { createMany: jest.fn().mockResolvedValue({ count: 2 }) }, idempotencyRecord: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}) } };
    const prisma = { idempotencyRecord: { findUnique: jest.fn().mockResolvedValue(null) }, $transaction: jest.fn((work: (client: typeof tx) => unknown) => work(tx)) } as unknown as PrismaService;

    const config = { publicBaseUrl: 'http://localhost/api/v1' } as MediaConfigService;
    const result = await new OwnerSalonsService(prisma, config).createWithFirstWorkspace('owner_1', {
      name: ' Luna Salon ', area: ' D1 ', timezone: 'Asia/Ho_Chi_Minh',
      workspace: { name: ' Chair A ', rentalLabel: ' 2 giờ ', priceCents: 250000 }
    }, 'idempotency_1', 'request_1');

    expect(result.salon).toEqual({ id: 'salon_1', name: 'Luna Salon', area: 'D1', timezone: 'Asia/Ho_Chi_Minh', media: [], workspaces: [{ id: 'workspace_1', name: 'Chair A', status: WorkspaceStatus.DRAFT, rentalOptions: [{ id: 'option_1', label: '2 giờ', priceCents: 250000 }], media: [] }] });
    expect(tx.salon.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        name: 'Luna Salon', area: 'D1',
        memberships: { create: { userId: 'owner_1', role: MembershipRole.OWNER } },
        workspaces: { create: expect.objectContaining({ status: WorkspaceStatus.DRAFT }) }
      })
    }));
    expect(tx.auditEvent.createMany).toHaveBeenCalledWith({ data: expect.arrayContaining([
      expect.objectContaining({ action: 'SALON_CREATED', requestId: 'request_1' }),
      expect.objectContaining({ action: 'WORKSPACE_CREATED', requestId: 'request_1' })
    ]) });
  });

  it('returns only Salons for which the caller has OWNER membership', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = { salon: { findMany } } as unknown as PrismaService;

    await expect(new OwnerSalonsService(prisma, { publicBaseUrl: 'http://localhost/api/v1' } as MediaConfigService).listOwned('owner_1')).resolves.toEqual([]);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { memberships: { some: { userId: 'owner_1', role: MembershipRole.OWNER } } }
    }));
  });
});
