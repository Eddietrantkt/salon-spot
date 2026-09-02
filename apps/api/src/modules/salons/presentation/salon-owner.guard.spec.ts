import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { SalonMembershipAuthorizer } from '../application/salon-membership-authorizer.js';
import { SalonOwnerGuard } from './salon-owner.guard.js';

function contextFor(request: { params: Record<string, string | undefined>; user?: { id: string; email: string; displayName: string } }): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request })
  } as unknown as ExecutionContext;
}

describe('SalonOwnerGuard', () => {
  it('delegates object authorization using the authenticated user and :salonId', async () => {
    const memberships = { assertOwner: jest.fn().mockResolvedValue(undefined) } as unknown as SalonMembershipAuthorizer;
    const guard = new SalonOwnerGuard(memberships);

    await expect(
      guard.canActivate(contextFor({ params: { salonId: 'salon_1' }, user: { id: 'user_1', email: 'owner@example.com', displayName: 'Owner' } }))
    ).resolves.toBe(true);
    expect(memberships.assertOwner).toHaveBeenCalledWith('user_1', 'salon_1');
  });

  it('rejects a request that did not pass authentication first', async () => {
    const memberships = { assertOwner: jest.fn() } as unknown as SalonMembershipAuthorizer;
    const guard = new SalonOwnerGuard(memberships);

    await expect(guard.canActivate(contextFor({ params: { salonId: 'salon_1' } }))).rejects.toThrow(UnauthorizedException);
  });
});
