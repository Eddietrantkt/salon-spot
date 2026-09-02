import { ConfigService } from '@nestjs/config';
import { AuthConfigService } from './auth-config.service.js';

describe('AuthConfigService', () => {
  it('reads valid security settings and hashes the same refresh token deterministically', () => {
    const values: Record<string, string> = {
      JWT_ACCESS_SECRET: 'a-valid-access-secret-with-more-than-thirty-two-characters',
      REFRESH_TOKEN_PEPPER: 'a-different-refresh-secret-with-more-than-thirty-two-characters',
      ACCESS_TOKEN_TTL_SECONDS: '900',
      REFRESH_TOKEN_TTL_DAYS: '14'
    };
    const config = { get: jest.fn((key: string) => values[key]) } as unknown as ConfigService;
    const authConfig = new AuthConfigService(config);

    expect(() => authConfig.onModuleInit()).not.toThrow();
    expect(authConfig.accessTokenTtlSeconds).toBe(900);
    expect(authConfig.refreshTokenTtlDays).toBe(14);
    expect(authConfig.hashRefreshToken('refresh-token')).toBe(authConfig.hashRefreshToken('refresh-token'));
  });

  it('rejects a placeholder security secret', () => {
    const config = {
      get: jest.fn((key: string) => (key === 'JWT_ACCESS_SECRET' ? 'replace-with-a-secret-that-is-not-safe-to-use' : undefined))
    } as unknown as ConfigService;
    const authConfig = new AuthConfigService(config);

    expect(() => authConfig.onModuleInit()).toThrow('JWT_ACCESS_SECRET');
  });
});
