import { WorkspaceStatus } from '@prisma/client';
import { PrismaService } from '../../../common/database/prisma/prisma.service.js';
import { MediaConfigService } from '../../../common/config/media-config.service.js';
import { OwnerWorkspacesService } from './owner-workspaces.service.js';

describe('OwnerWorkspacesService', () => {
  it('creates an additional draft Workspace and writes an audit event', async () => {
    const workspace = { id: 'workspace_2', name: 'Suite B', status: WorkspaceStatus.DRAFT, coverMediaId: null, media: [], rentalOptions: [{ id: 'option_2', label: 'Cả ngày', priceCents: 600000 }] };
    const tx = { workspace: { create: jest.fn().mockResolvedValue(workspace) }, auditEvent: { create: jest.fn().mockResolvedValue({}) }, idempotencyRecord: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}) } };
    const prisma = { idempotencyRecord: { findUnique: jest.fn().mockResolvedValue(null) }, $transaction: jest.fn((work: (client: typeof tx) => unknown) => work(tx)) } as unknown as PrismaService;

    await expect(new OwnerWorkspacesService(prisma, { publicBaseUrl: 'http://localhost/api/v1' } as MediaConfigService).create('salon_1', 'owner_1', { name: ' Suite B ', rentalLabel: ' Cả ngày ', priceCents: 600000 }, 'idempotency_2', 'request_2')).resolves.toEqual({ workspace: { id: 'workspace_2', name: 'Suite B', status: WorkspaceStatus.DRAFT, rentalOptions: workspace.rentalOptions, media: [] } });
    expect(tx.workspace.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ salonId: 'salon_1', name: 'Suite B', status: WorkspaceStatus.DRAFT }) }));
    expect(tx.auditEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ actorUserId: 'owner_1', action: 'WORKSPACE_CREATED', requestId: 'request_2' }) });
  });
});
