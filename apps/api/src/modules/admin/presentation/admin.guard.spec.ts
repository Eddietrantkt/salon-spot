import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AdminAccessService } from '../application/admin-access.service.js';
import { AdminGuard } from './admin.guard.js';

function contextFor(user?: { id: string; email: string; displayName: string }): ExecutionContext {
  return { switchToHttp: () => ({ getRequest: () => ({ user }) }) } as unknown as ExecutionContext;
}

describe('AdminGuard', () => {
  it('delegates platform access to AdminAccess, not Salon membership', async () => {
    const access = { assertAdmin: jest.fn().mockResolvedValue(undefined) } as unknown as AdminAccessService;
    await expect(new AdminGuard(access).canActivate(contextFor({ id: 'operations_1', email: 'admin@example.com', displayName: 'Admin' }))).resolves.toBe(true);
    expect(access.assertAdmin).toHaveBeenCalledWith('operations_1');
  });

  it('requires authentication to run first', async () => {
    const access = { assertAdmin: jest.fn() } as unknown as AdminAccessService;
    await expect(new AdminGuard(access).canActivate(contextFor())).rejects.toThrow(UnauthorizedException);
  });
});
