import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { AuthConfigService } from './auth-config.service.js';

export interface AccessTokenClaims {
  sub: string;
  email: string;
  iat: number;
  exp: number;
  typ: 'access';
}

export interface IssuedAccessToken {
  token: string;
  expiresAt: Date;
}

@Injectable()
export class AccessTokenService {
  constructor(private readonly config: AuthConfigService) {}

  issue(user: Pick<AccessTokenClaims, 'sub' | 'email'>): IssuedAccessToken {
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = new Date((now + this.config.accessTokenTtlSeconds) * 1000);
    const claims: AccessTokenClaims = { ...user, iat: now, exp: Math.floor(expiresAt.getTime() / 1000), typ: 'access' };
    const encodedHeader = this.encode({ alg: 'HS256', typ: 'JWT' });
    const encodedClaims = this.encode(claims);
    const signingInput = `${encodedHeader}.${encodedClaims}`;
    const signature = this.sign(signingInput);
    return { token: `${signingInput}.${signature}`, expiresAt };
  }

  verify(token: string): AccessTokenClaims {
    const [encodedHeader, encodedClaims, suppliedSignature, ...extra] = token.split('.');
    if (!encodedHeader || !encodedClaims || !suppliedSignature || extra.length > 0) throw new UnauthorizedException();

    const signingInput = `${encodedHeader}.${encodedClaims}`;
    if (!this.matchesSignature(suppliedSignature, this.sign(signingInput))) throw new UnauthorizedException();

    try {
      const header = this.decode<{ alg?: string; typ?: string }>(encodedHeader);
      const claims = this.decode<Partial<AccessTokenClaims>>(encodedClaims);
      if (header.alg !== 'HS256' || header.typ !== 'JWT' || claims.typ !== 'access') throw new UnauthorizedException();
      if (
        typeof claims.sub !== 'string' ||
        typeof claims.email !== 'string' ||
        typeof claims.iat !== 'number' ||
        typeof claims.exp !== 'number'
      ) {
        throw new UnauthorizedException();
      }
      if (claims.exp <= Math.floor(Date.now() / 1000)) throw new UnauthorizedException();
      return claims as AccessTokenClaims;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException();
    }
  }

  private encode(value: object): string {
    return Buffer.from(JSON.stringify(value)).toString('base64url');
  }

  private decode<T>(value: string): T {
    return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as T;
  }

  private sign(value: string): string {
    return createHmac('sha256', this.config.accessTokenSecret).update(value).digest('base64url');
  }

  private matchesSignature(supplied: string, expected: string): boolean {
    const suppliedBuffer = Buffer.from(supplied);
    const expectedBuffer = Buffer.from(expected);
    return suppliedBuffer.length === expectedBuffer.length && timingSafeEqual(suppliedBuffer, expectedBuffer);
  }
}
