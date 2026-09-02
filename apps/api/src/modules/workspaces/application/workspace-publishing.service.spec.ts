import { MediaStatus, WorkspaceStatus } from '@prisma/client';
import { MediaConfigService } from '../../../common/config/media-config.service.js';
import { PrismaService } from '../../../common/database/prisma/prisma.service.js';
import { WorkspacePublishingService } from './workspace-publishing.service.js';

describe('WorkspacePublishingService', () => {
  const config = { publicBaseUrl: 'http://localhost:3000/api/v1' } as MediaConfigService;

  it('blocks publish while an upload is incomplete', async () => {
    const workspace = {
      id: 'workspace_1', salonId: 'salon_1', name: 'Chair A', status: WorkspaceStatus.DRAFT, coverMediaId: null,
      salon: { name: 'Salon One', area: 'D1', timezone: 'Asia/Ho_Chi_Minh' },
      rentalOptions: [{ id: 'option_1', label: '2 giờ', priceCents: 250000 }],
      media: [{ id: 'media_1', status: MediaStatus.PROCESSING, contentType: 'image/jpeg', byteSize: null, width: null, height: null, sortOrder: 0, failureReason: null }]
    };
    const prisma = { workspace: { findFirst: jest.fn().mockResolvedValue(workspace) } } as unknown as PrismaService;

    const result = await new WorkspacePublishingService(prisma, config).checklist('salon_1', 'workspace_1');

    expect(result.eligible).toBe(false);
    expect(result.checks).toContainEqual(expect.objectContaining({ code: 'MEDIA_PROCESSING', passed: false }));
  });

  it('publishes valid supply and writes the state transition audit in the same transaction', async () => {
    const current = {
      id: 'workspace_1', salonId: 'salon_1', name: 'Chair A', status: WorkspaceStatus.DRAFT, coverMediaId: null,
      salon: { name: 'Salon One', area: 'D1', timezone: 'Asia/Ho_Chi_Minh' },
      rentalOptions: [{ id: 'option_1', label: '2 giờ', priceCents: 250000 }], media: []
    };
    const updated = { ...current, status: WorkspaceStatus.PUBLISHED };
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'workspace_1' }]),
      workspace: { findFirst: jest.fn().mockResolvedValue(current), update: jest.fn().mockResolvedValue(updated) },
      auditEvent: { create: jest.fn().mockResolvedValue({}) }
    };
    const prisma = { $transaction: jest.fn((work: (client: typeof tx) => unknown) => work(tx)) } as unknown as PrismaService;

    const result = await new WorkspacePublishingService(prisma, config).publish('salon_1', 'workspace_1', 'owner_1', 'request_1');

    expect(result.workspace.status).toBe('PUBLISHED');
    expect(tx.workspace.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: WorkspaceStatus.PUBLISHED } }));
    expect(tx.auditEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'WORKSPACE_PUBLISHED', requestId: 'request_1' }) });
  });
});
