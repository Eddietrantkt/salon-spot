import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { resolve } from 'node:path';

const DEFAULT_UPLOAD_TTL_SECONDS = 900;
const DEFAULT_MAX_UPLOAD_BYTES = 10_000_000;
const DEFAULT_MAX_PIXEL_COUNT = 40_000_000;

@Injectable()
export class MediaConfigService implements OnModuleInit {
  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    void this.uploadSecret;
    void this.uploadTtlSeconds;
    void this.maxUploadBytes;
    void this.maxPixelCount;
  }

  get uploadSecret(): string {
    const value = this.config.get<string>('MEDIA_UPLOAD_SECRET');
    if (!value || value.length < 32 || value.includes('replace-with-')) {
      throw new Error('MEDIA_UPLOAD_SECRET must contain a unique secret of at least 32 characters.');
    }
    return value;
  }

  get publicBaseUrl(): string {
    return (this.config.get<string>('MEDIA_PUBLIC_BASE_URL') ?? 'http://localhost:3000/api/v1').replace(/\/$/, '');
  }

  get storageRoot(): string {
    return resolve(this.config.get<string>('MEDIA_STORAGE_ROOT') ?? '.data/media');
  }

  get uploadTtlSeconds(): number {
    return this.readPositiveInteger('MEDIA_UPLOAD_TTL_SECONDS', DEFAULT_UPLOAD_TTL_SECONDS);
  }

  get maxUploadBytes(): number {
    return this.readPositiveInteger('MEDIA_MAX_UPLOAD_BYTES', DEFAULT_MAX_UPLOAD_BYTES);
  }

  get maxPixelCount(): number {
    return this.readPositiveInteger('MEDIA_MAX_PIXEL_COUNT', DEFAULT_MAX_PIXEL_COUNT);
  }

  private readPositiveInteger(name: string, fallback: number): number {
    const rawValue = this.config.get<string>(name);
    if (!rawValue) return fallback;
    const value = Number(rawValue);
    if (!Number.isInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer.`);
    return value;
  }
}
