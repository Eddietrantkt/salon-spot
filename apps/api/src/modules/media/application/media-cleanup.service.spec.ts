import { OutboxStatus } from '@prisma/client';
import { PrismaService } from '../../../common/database/prisma/prisma.service.js';
import { MediaStorageService } from './media-storage.service.js';
import { MediaCleanupService } from './media-cleanup.service.js';

describe('MediaCleanupService', () => {
  it('reclaims an expired PROCESSING outbox lease after a worker crash', async () => {
    const event = {
      id: 'event_1', topic: 'MEDIA_STORAGE_CLEANUP_REQUESTED', status: OutboxStatus.PROCESSING, attempts: 1,
      availableAt: new Date(Date.now() - 1_000), createdAt: new Date(),
      payload: { kind: 'workspace', mediaId: 'media_1', storageKey: 'staging/workspaces/workspace_1/file.jpg' }
    };
    const tx = {
      workspaceMedia: { updateMany: jest.fn() },
      salonMedia: { updateMany: jest.fn() },
      outboxEvent: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      auditEvent: { create: jest.fn().mockResolvedValue({}) }
    };
    const findMany = jest.fn().mockResolvedValue([event]);
    const prisma = {
      outboxEvent: { findMany, updateMany: jest.fn().mockResolvedValue({ count: 1 }), update: jest.fn() },
      $transaction: jest.fn((work: (client: typeof tx) => unknown) => work(tx))
    } as unknown as PrismaService;
    const storage = { delete: jest.fn().mockResolvedValue(undefined) } as unknown as MediaStorageService;

    await expect(new MediaCleanupService(prisma, storage).processBatch()).resolves.toBe(1);

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        OR: expect.arrayContaining([expect.objectContaining({ status: OutboxStatus.PROCESSING, availableAt: { lte: expect.any(Date) } })])
      })
    }));
    expect(prisma.outboxEvent.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: 'event_1',
        OR: expect.arrayContaining([expect.objectContaining({ status: OutboxStatus.PROCESSING, availableAt: { lte: expect.any(Date) } })])
      }),
      data: expect.objectContaining({ status: OutboxStatus.PROCESSING, availableAt: expect.any(Date) })
    }));
  });

  it('claims an outbox event, removes the object and commits DELETED with delivery audit', async () => {
    const event = {
      id: 'event_1', topic: 'MEDIA_DELETE_REQUESTED', status: OutboxStatus.PENDING, attempts: 0,
      availableAt: new Date(), createdAt: new Date(),
      payload: { kind: 'workspace', mediaId: 'media_1', storageKey: 'ready/workspaces/workspace_1/file.jpg' }
    };
    const tx = {
      workspaceMedia: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      salonMedia: { updateMany: jest.fn() },
      outboxEvent: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      auditEvent: { create: jest.fn().mockResolvedValue({}) }
    };
    const prisma = {
      outboxEvent: {
        findMany: jest.fn().mockResolvedValue([event]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn()
      },
      $transaction: jest.fn((work: (client: typeof tx) => unknown) => work(tx))
    } as unknown as PrismaService;
    const storage = { delete: jest.fn().mockResolvedValue(undefined) } as unknown as MediaStorageService;

    await expect(new MediaCleanupService(prisma, storage).processBatch()).resolves.toBe(1);

    expect(storage.delete).toHaveBeenCalledWith(event.payload.storageKey);
    expect(tx.workspaceMedia.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: 'media_1' }) }));
    expect(tx.outboxEvent.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'event_1', status: OutboxStatus.PROCESSING, availableAt: expect.any(Date) }),
      data: { status: OutboxStatus.DELIVERED }
    }));
    expect(tx.auditEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'MEDIA_DELETED' }) });
  });

  it('rejects expired upload intents and schedules retryable staging cleanup', async () => {
    const tx = {
      salonMedia: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      workspaceMedia: { updateMany: jest.fn() },
      outboxEvent: { create: jest.fn().mockResolvedValue({}) },
      auditEvent: { create: jest.fn().mockResolvedValue({}) }
    };
    const prisma = {
      salonMedia: { findMany: jest.fn().mockResolvedValue([{ id: 'media_1', storageKey: 'staging/salons/salon_1/file.jpg' }]) },
      workspaceMedia: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn((work: (client: typeof tx) => unknown) => work(tx))
    } as unknown as PrismaService;
    const storage = {} as MediaStorageService;

    await expect(new MediaCleanupService(prisma, storage).expireStaleUploads()).resolves.toBe(1);

    expect(tx.salonMedia.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ failureReason: 'Upload intent expired.' }) }));
    expect(tx.outboxEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ topic: 'MEDIA_STORAGE_CLEANUP_REQUESTED' }) });
    expect(tx.auditEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'MEDIA_UPLOAD_EXPIRED' }) });
  });

  it('returns interrupted PROCESSING records to a retryable state', async () => {
    const salonUpdate = jest.fn().mockResolvedValue({ count: 1 });
    const workspaceUpdate = jest.fn().mockResolvedValue({ count: 0 });
    const prisma = {
      salonMedia: { updateMany: salonUpdate },
      workspaceMedia: { updateMany: workspaceUpdate },
      $transaction: jest.fn((operations: readonly Promise<unknown>[]) => Promise.all(operations))
    } as unknown as PrismaService;

    await expect(new MediaCleanupService(prisma, {} as MediaStorageService).recoverStaleProcessing()).resolves.toBe(1);

    expect(salonUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: 'PROCESSING' }),
      data: expect.objectContaining({ status: 'PENDING_UPLOAD' }),
      limit: 10
    }));
  });
});
