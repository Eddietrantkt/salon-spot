import { MediaStatus } from '@prisma/client';
import { MediaConfigService } from '../../../common/config/media-config.service.js';
import { PrismaService } from '../../../common/database/prisma/prisma.service.js';
import { MediaStorageService } from './media-storage.service.js';
import { OwnerMediaService } from './owner-media.service.js';

describe('OwnerMediaService', () => {
  const config = { maxUploadBytes: 10_000_000, publicBaseUrl: 'http://localhost:3000/api/v1' } as MediaConfigService;

  it('locks the parent and enforces the media count before issuing persisted Workspace media', async () => {
    const created = {
      id: 'media_1', workspaceId: 'workspace_1', storageKey: 'staging/workspaces/workspace_1/file.jpg',
      contentType: 'image/jpeg', byteSize: null, checksumSha256: null, width: null, height: null,
      failureReason: null, status: MediaStatus.PENDING_UPLOAD, sortOrder: 0, createdAt: new Date(), updatedAt: new Date()
    };
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'workspace_1' }]),
      workspaceMedia: {
        count: jest.fn().mockResolvedValue(0),
        aggregate: jest.fn().mockResolvedValue({ _max: { sortOrder: null } }),
        create: jest.fn().mockResolvedValue(created)
      },
      auditEvent: { create: jest.fn().mockResolvedValue({}) }
    };
    const prisma = {
      workspace: { findFirst: jest.fn().mockResolvedValue({ id: 'workspace_1' }) },
      $transaction: jest.fn((work: (client: typeof tx) => unknown) => work(tx))
    } as unknown as PrismaService;
    const storage = {
      createUpload: jest.fn().mockReturnValue({ storageKey: created.storageKey, url: 'http://localhost/upload', expiresAt: new Date('2026-08-25T01:00:00Z') })
    } as unknown as MediaStorageService;

    const result = await new OwnerMediaService(prisma, storage, config).createWorkspaceUploadIntent(
      'salon_1', 'workspace_1', 'owner_1', { contentType: 'image/jpeg' }, 'request_1'
    );

    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.workspaceMedia.count).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ workspaceId: 'workspace_1' }) }));
    expect(result.media).toMatchObject({ id: 'media_1', status: 'PENDING_UPLOAD', url: null });
    expect(tx.auditEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'MEDIA_UPLOAD_INTENT_CREATED', requestId: 'request_1' }) });
  });

  it('rejects a Workspace ID that is not inside the authorized Salon before creating an upload', async () => {
    const prisma = { workspace: { findFirst: jest.fn().mockResolvedValue(null) } } as unknown as PrismaService;
    const storage = { createUpload: jest.fn() } as unknown as MediaStorageService;

    await expect(new OwnerMediaService(prisma, storage, config).createWorkspaceUploadIntent(
      'salon_1', 'workspace_from_other_salon', 'owner_1', { contentType: 'image/jpeg' }
    )).rejects.toThrow('Workspace was not found in this Salon');
    expect(storage.createUpload).not.toHaveBeenCalled();
  });

  it('stores and returns a safe image-processing failure without exposing the raw storage error', async () => {
    const media = {
      id: 'media_1', salonId: 'salon_1', storageKey: 'staging/salons/salon_1/private-source.jpg', contentType: 'image/jpeg',
      byteSize: null, checksumSha256: null, width: null, height: null, failureReason: null, uploadExpiresAt: new Date('2099-12-10T00:00:00.000Z'),
      status: MediaStatus.PENDING_UPLOAD, sortOrder: 0, createdAt: new Date(), updatedAt: new Date()
    };
    const tx = {
      salonMedia: { update: jest.fn().mockResolvedValue({}) },
      auditEvent: { create: jest.fn().mockResolvedValue({}) },
      outboxEvent: { create: jest.fn().mockResolvedValue({}) }
    };
    const prisma = {
      salonMedia: { findFirst: jest.fn().mockResolvedValue(media), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      $transaction: jest.fn((work: (client: typeof tx) => unknown) => work(tx))
    } as unknown as PrismaService;
    const rawError = new Error('VipsJpeg: invalid marker at C:\\private\\source.jpg');
    const storage = { processImage: jest.fn().mockRejectedValue(rawError) } as unknown as MediaStorageService;
    const service = new OwnerMediaService(prisma, storage, config);
    const logger = jest.spyOn((service as unknown as { logger: { error: (message: string, detail?: string) => void } }).logger, 'error').mockImplementation(() => undefined);

    await expect(service.finalizeSalon('salon_1', 'media_1', 'owner_1', 'request-media-1')).rejects.toMatchObject({
      response: expect.objectContaining({ message: 'The image is invalid or could not be processed. Please choose a different JPEG, PNG, or WebP image.' })
    });

    expect(tx.salonMedia.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: MediaStatus.REJECTED, failureReason: 'The image is invalid or could not be processed. Please choose a different JPEG, PNG, or WebP image.' }) }));
    expect(tx.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ requestId: 'request-media-1', after: { reason: 'The image is invalid or could not be processed. Please choose a different JPEG, PNG, or WebP image.' } }) }));
    expect(JSON.stringify(tx.salonMedia.update.mock.calls)).not.toContain(rawError.message);
    expect(logger).toHaveBeenCalledWith(expect.stringContaining('mediaId=media_1, requestId=request-media-1'), expect.stringContaining(rawError.message));
  });

  it('hides a deleted Workspace image immediately and schedules storage cleanup', async () => {
    const media = {
      id: 'media_1', workspaceId: 'workspace_1', storageKey: 'ready/workspaces/workspace_1/file.jpg',
      contentType: 'image/jpeg', byteSize: 100, checksumSha256: 'checksum', width: 10, height: 10,
      failureReason: null, status: MediaStatus.READY, sortOrder: 0, uploadExpiresAt: null,
      createdAt: new Date(), updatedAt: new Date()
    };
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'workspace_1' }]),
      workspaceMedia: { findFirst: jest.fn().mockResolvedValue(media), update: jest.fn().mockResolvedValue({}) },
      workspace: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      outboxEvent: { create: jest.fn().mockResolvedValue({}) },
      auditEvent: { create: jest.fn().mockResolvedValue({}) }
    };
    const prisma = {
      workspace: { findFirst: jest.fn().mockResolvedValue({ id: 'workspace_1' }) },
      $transaction: jest.fn((work: (client: typeof tx) => unknown) => work(tx))
    } as unknown as PrismaService;

    const result = await new OwnerMediaService(prisma, {} as MediaStorageService, config).deleteWorkspace(
      'salon_1', 'workspace_1', 'media_1', 'owner_1', 'request_1'
    );

    expect(result).toMatchObject({ id: 'media_1', status: MediaStatus.DELETE_PENDING, url: null });
    expect(tx.workspace.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { coverMediaId: null } }));
    expect(tx.workspaceMedia.update).toHaveBeenCalledWith({ where: { id: 'media_1' }, data: { status: MediaStatus.DELETE_PENDING } });
    expect(tx.outboxEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ topic: 'MEDIA_DELETE_REQUESTED' }) }));
  });
});
