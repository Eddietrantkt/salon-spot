import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';

const DEFAULT_ACCESS_TOKEN_TTL_SECONDS = 900;
const DEFAULT_REFRESH_TOKEN_TTL_DAYS = 14;

@Injectable()
export class AuthConfigService implements OnModuleInit {
  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    void this.accessTokenSecret;
    void this.refreshTokenPepper;
    void this.accessTokenTtlSeconds;
    void this.refreshTokenTtlDays;
  }

  get accessTokenSecret(): string {
    return this.readSecret('JWT_ACCESS_SECRET');
  }

  get refreshTokenPepper(): string {
    return this.readSecret('REFRESH_TOKEN_PEPPER');
  }

  get accessTokenTtlSeconds(): number {
    return this.readPositiveNumber('ACCESS_TOKEN_TTL_SECONDS', DEFAULT_ACCESS_TOKEN_TTL_SECONDS);
  }

  get refreshTokenTtlDays(): number {
    return this.readPositiveNumber('REFRESH_TOKEN_TTL_DAYS', DEFAULT_REFRESH_TOKEN_TTL_DAYS);
  }

  hashRefreshToken(refreshToken: string): string {
    return createHmac('sha256', this.refreshTokenPepper).update(refreshToken).digest('hex');
  }

  private readSecret(name: string): string {
    const value = this.config.get<string>(name);
    if (!value || value.length < 32 || value.includes('replace-with-')) {
      throw new Error(`${name} must contain a unique secret of at least 32 characters.`);
    }
    return value;
  }

  private readPositiveNumber(name: string, fallback: number): number {
    const rawValue = this.config.get<string>(name);
    if (!rawValue) return fallback;
    const value = Number(rawValue);
    if (!Number.isInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer.`);
    return value;
  }
}
