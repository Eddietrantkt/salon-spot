import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ProfessionalAccessService } from '../application/professional-access.service.js';
import { ProfessionalGuard } from './professional.guard.js';

function contextFor(user?: { id: string; email: string; displayName: string }): ExecutionContext {
  return { switchToHttp: () => ({ getRequest: () => ({ user }) }) } as unknown as ExecutionContext;
}

describe('ProfessionalGuard', () => {
  it('delegates the role decision to ProfessionalAccessService', async () => {
    const access = { assertActive: jest.fn().mockResolvedValue(undefined) } as unknown as ProfessionalAccessService;
    await expect(new ProfessionalGuard(access).canActivate(contextFor({ id: 'professional_1', email: 'pro@example.test', displayName: 'Pro' }))).resolves.toBe(true);
    expect(access.assertActive).toHaveBeenCalledWith('professional_1');
  });

  it('requires authentication to run first', async () => {
    const access = { assertActive: jest.fn() } as unknown as ProfessionalAccessService;
    await expect(new ProfessionalGuard(access).canActivate(contextFor())).rejects.toThrow(UnauthorizedException);
  });
});
