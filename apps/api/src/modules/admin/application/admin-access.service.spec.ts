import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../common/database/prisma/prisma.service.js';
import { AdminAccessService } from './admin-access.service.js';

describe('AdminAccessService', () => {
  it('accepts a platform-admin grant without consulting SalonMembership', async () => {
    const findUnique = jest.fn().mockResolvedValue({ userId: 'operations_1' });
    const prisma = { adminAccess: { findUnique } } as unknown as PrismaService;

    await expect(new AdminAccessService(prisma).assertAdmin('operations_1')).resolves.toBeUndefined();
    expect(findUnique).toHaveBeenCalledWith({ where: { userId: 'operations_1' }, select: { userId: true } });
  });

  it('rejects an authenticated account that has no operations grant', async () => {
    const prisma = { adminAccess: { findUnique: jest.fn().mockResolvedValue(null) } } as unknown as PrismaService;
    await expect(new AdminAccessService(prisma).assertAdmin('owner_only')).rejects.toThrow(ForbiddenException);
  });
});
