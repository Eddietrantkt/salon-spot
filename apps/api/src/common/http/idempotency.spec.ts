import { ConflictException } from '@nestjs/common';
import { PrismaService } from '../database/prisma/prisma.service.js';
import { executeIdempotently } from './idempotency.js';

describe('executeIdempotently', () => {
  it('replays the first result instead of executing a retry again', async () => {
    let stored: { requestHash: string; responseBody: { workspaceId: string } } | null = null;
    const findUnique = jest.fn(async () => stored);
    const create = jest.fn(async ({ data }: { data: { requestHash: string; responseBody: { workspaceId: string } } }) => {
      stored = { requestHash: data.requestHash, responseBody: data.responseBody };
    });
    const tx = { idempotencyRecord: { findUnique, create } };
    const prisma = {
      idempotencyRecord: { findUnique },
      $transaction: jest.fn((work: (client: typeof tx) => unknown) => work(tx))
    } as unknown as PrismaService;
    const operation = jest.fn(async () => ({ workspaceId: 'workspace_1' }));

    const first = await executeIdempotently(prisma, 'owner_1', 'owner-workspace-create:salon_1', 'retry_1', { name: 'Chair A' }, operation);
    const second = await executeIdempotently(prisma, 'owner_1', 'owner-workspace-create:salon_1', 'retry_1', { name: 'Chair A' }, operation);

    expect(first).toEqual({ workspaceId: 'workspace_1' });
    expect(second).toEqual(first);
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('rejects reusing a key for a different request body', async () => {
    const prisma = {
      idempotencyRecord: {
        findUnique: jest.fn().mockResolvedValue({ requestHash: 'different-hash', responseBody: { workspaceId: 'workspace_1' } })
      }
    } as unknown as PrismaService;

    await expect(executeIdempotently(prisma, 'owner_1', 'owner-workspace-create:salon_1', 'retry_1', { name: 'Chair B' }, async () => ({ workspaceId: 'workspace_2' })))
      .rejects.toThrow(ConflictException);
  });
});
