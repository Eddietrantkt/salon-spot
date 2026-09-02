import { UnauthorizedException } from '@nestjs/common';
import { AccessTokenService } from './access-token.service.js';
import type { AuthConfigService } from './auth-config.service.js';

describe('AccessTokenService', () => {
  const config = {
    accessTokenSecret: 'a-very-long-test-secret-that-is-not-used-outside-tests',
    accessTokenTtlSeconds: 60
  } as AuthConfigService;
  const tokens = new AccessTokenService(config);

  it('issues and verifies an HS256 access token', () => {
    const issued = tokens.issue({ sub: 'user_1', email: 'owner@example.com' });

    expect(tokens.verify(issued.token)).toMatchObject({ sub: 'user_1', email: 'owner@example.com', typ: 'access' });
  });

  it('rejects a token with a modified payload', () => {
    const issued = tokens.issue({ sub: 'user_1', email: 'owner@example.com' });
    const [header, , signature] = issued.token.split('.');
    const alteredPayload = Buffer.from(JSON.stringify({ sub: 'user_2', email: 'owner@example.com', typ: 'access', exp: 9999999999 })).toString('base64url');

    expect(() => tokens.verify(`${header}.${alteredPayload}.${signature}`)).toThrow(UnauthorizedException);
  });
});
