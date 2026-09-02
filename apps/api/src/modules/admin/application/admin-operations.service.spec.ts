import { ForbiddenException } from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import { PrismaService } from '../../../common/database/prisma/prisma.service.js';
import { AdminOperationsService } from './admin-operations.service.js';

describe('AdminOperationsService', () => {
  it('suspends a non-admin account, revokes sessions, and records the reason atomically', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 2 });
    const auditCreate = jest.fn().mockResolvedValue({});
    const selectedUser = {
      id: 'user_2', email: 'member@example.com', displayName: 'Member', status: UserStatus.SUSPENDED, createdAt: new Date('2026-08-27T00:00:00.000Z'),
      adminAccess: null, _count: { memberships: 0, bookings: 1 }
    };
    const tx = {
      idempotencyRecord: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}) },
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 'user_2', status: UserStatus.ACTIVE, adminAccess: null }),
        update: jest.fn().mockResolvedValue(selectedUser)
      },
      authSession: { updateMany },
      auditEvent: { create: auditCreate }
    };
    const prisma = {
      idempotencyRecord: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn((work: (client: typeof tx) => unknown) => work(tx))
    } as unknown as PrismaService;

    const result = await new AdminOperationsService(prisma).updateUserStatus('operations_1', 'user_2', { status: UserStatus.SUSPENDED, reason: 'Repeated policy violation' }, 'status-key', 'request_1');

    expect(result.user).toMatchObject({ id: 'user_2', status: 'SUSPENDED', isAdmin: false });
    expect(updateMany).toHaveBeenCalledWith({ where: { userId: 'user_2', revokedAt: null }, data: { revokedAt: expect.any(Date) } });
    expect(auditCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'ADMIN_USER_SUSPENDED', requestId: 'request_1', after: { status: UserStatus.SUSPENDED, reason: 'Repeated policy violation' } }) });
  });

  it('does not let an admin account be suspended through the routine maintenance path', async () => {
    const tx = {
      idempotencyRecord: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn() },
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'operations_2', status: UserStatus.ACTIVE, adminAccess: { userId: 'operations_2' } }) },
      authSession: { updateMany: jest.fn() }, auditEvent: { create: jest.fn() }
    };
    const prisma = { idempotencyRecord: { findUnique: jest.fn().mockResolvedValue(null) }, $transaction: jest.fn((work: (client: typeof tx) => unknown) => work(tx)) } as unknown as PrismaService;

    await expect(new AdminOperationsService(prisma).updateUserStatus('operations_1', 'operations_2', { status: UserStatus.SUSPENDED, reason: 'Not allowed' }, 'status-key')).rejects.toThrow(ForbiddenException);
  });
});
