import assert from 'node:assert/strict';
import test from 'node:test';
import type { AuthenticationResponse } from '@salon-spot/contracts';
import { canAccessRoleRoute, navigationDestinations } from '../src/app/session-access.ts';

function session(capabilities: AuthenticationResponse['capabilities']): AuthenticationResponse {
  return {
    user: { id: 'user_1', email: 'person@example.com', displayName: 'Person' },
    capabilities,
    accessToken: 'token',
    accessTokenExpiresAt: '2026-09-10T00:00:00.000Z'
  };
}

test('guest navigation exposes only Explore and Sign in', () => {
  assert.deepEqual(navigationDestinations(null), ['discovery', 'login']);
});

test('each signed-in account sees only its server-issued capabilities', () => {
  assert.deepEqual(navigationDestinations(session({ professionalStatus: 'ACTIVE', owner: false, admin: false })), ['discovery', 'bookings', 'notifications', 'professional-onboarding']);
  assert.deepEqual(navigationDestinations(session({ professionalStatus: null, owner: true, admin: false })), ['discovery', 'notifications', 'owner']);
  assert.deepEqual(navigationDestinations(session({ professionalStatus: null, owner: false, admin: true })), ['discovery', 'notifications', 'admin']);
});

test('direct role routes are denied when the matching capability is absent', () => {
  const owner = session({ professionalStatus: null, owner: true, admin: false });
  assert.equal(canAccessRoleRoute('owner', owner), true);
  assert.equal(canAccessRoleRoute('admin', owner), false);
  assert.equal(canAccessRoleRoute('bookings', owner), false);
  assert.equal(canAccessRoleRoute('bookings', owner, true), true);
});
