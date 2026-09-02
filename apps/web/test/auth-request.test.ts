import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAuthenticationRequest } from '../src/features/auth/auth-request.ts';

test('builds a strict login payload without a display name', () => {
  assert.deepEqual(buildAuthenticationRequest('login', {
    email: 'member@example.com', displayName: 'Member', password: 'password-123'
  }), {
    mode: 'login', input: { email: 'member@example.com', password: 'password-123' }
  });
});

test('keeps the display name only for registration', () => {
  assert.deepEqual(buildAuthenticationRequest('register', {
    email: 'member@example.com', displayName: 'Member', password: 'password-123', onboardingIntent: 'PROFESSIONAL'
  }), {
    mode: 'register', input: { email: 'member@example.com', displayName: 'Member', password: 'password-123', onboardingIntent: 'PROFESSIONAL' }
  });
});
