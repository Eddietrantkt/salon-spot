import { BadRequestException, ConflictException, Injectable, NotFoundException, PayloadTooLargeException, UnauthorizedException } from '@nestjs/common';
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { constants, createReadStream, createWriteStream } from 'node:fs';
import { copyFile, mkdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { Transform, type Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import sharp from 'sharp';
import { MediaConfigService } from '../../../common/config/media-config.service.js';

export type MediaParentKind = 'salon' | 'workspace';
export type AllowedMediaType = 'image/jpeg' | 'image/png' | 'image/webp';

interface UploadClaims {
  storageKey: string;
  contentType: AllowedMediaType;
  maxBytes: number;
  expiresAtEpochSeconds: number;
}

export interface ProcessedImage {
  storageKey: string;
  contentType: AllowedMediaType;
  byteSize: number;
  checksumSha256: string;
  width: number;
  height: number;
}

const extensions: Record<AllowedMediaType, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp'
};

const formats: Record<AllowedMediaType, 'jpeg' | 'png' | 'webp'> = {
  'image/jpeg': 'jpeg',
  'image/png': 'png',
  'image/webp': 'webp'
};

@Injectable()
export class MediaStorageService {
  constructor(private readonly config: MediaConfigService) {}

  createUpload(kind: MediaParentKind, parentId: string, contentType: AllowedMediaType): {
    storageKey: string;
    url: string;
    expiresAt: Date;
  } {
    const storageKey = `staging/${kind}s/${parentId}/${randomUUID()}${extensions[contentType]}`;
    const expiresAt = new Date(Date.now() + this.config.uploadTtlSeconds * 1000);
    const claims: UploadClaims = {
      storageKey,
      contentType,
      maxBytes: this.config.maxUploadBytes,
      expiresAtEpochSeconds: Math.floor(expiresAt.getTime() / 1000)
    };
    const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
    const signature = createHmac('sha256', this.config.uploadSecret).update(payload).digest('base64url');
    return {
      storageKey,
      expiresAt,
      url: `${this.config.publicBaseUrl}/media/uploads/${payload}.${signature}`
    };
  }

  async acceptUpload(token: string, contentType: string | undefined, body: Readable): Promise<void> {
    const claims = this.verifyToken(token);
    if (contentType !== claims.contentType) throw new BadRequestException(`Content-Type must be ${claims.contentType}.`);

    const target = this.resolveStorageKey(claims.storageKey);
    const temporary = `${target}.part-${randomUUID()}`;
    await mkdir(dirname(target), { recursive: true });
    let bytes = 0;

    try {
      const limiter = new Transform({
        transform(chunk: Buffer, _encoding, callback) {
          bytes += chunk.length;
          if (bytes > claims.maxBytes) callback(new PayloadTooLargeException(`Image exceeds ${claims.maxBytes} bytes.`));
          else callback(null, chunk);
        }
      });
      await pipeline(body, limiter, createWriteStream(temporary, { flags: 'wx' }));
      if (bytes === 0) throw new BadRequestException('Uploaded image is empty.');
      await copyFile(temporary, target, constants.COPYFILE_EXCL);
      await rm(temporary, { force: true });
    } catch (error) {
      await rm(temporary, { force: true });
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') throw new ConflictException('Upload token has already been used.');
      throw error;
    }
  }

  async processImage(storageKey: string, declaredContentType: string): Promise<ProcessedImage> {
    if (!(declaredContentType in formats)) throw new BadRequestException('Unsupported media type.');
    const contentType = declaredContentType as AllowedMediaType;
    const source = this.resolveStorageKey(storageKey);
    const sourceStat = await stat(source).catch(() => null);
    if (!sourceStat?.isFile()) throw new BadRequestException('Uploaded object was not found.');
    if (sourceStat.size > this.config.maxUploadBytes) throw new PayloadTooLargeException('Uploaded image is too large.');

    const image = sharp(source, { limitInputPixels: this.config.maxPixelCount, animated: false, failOn: 'error' });
    const metadata = await image.metadata();
    if (!metadata.width || !metadata.height || !metadata.format) throw new BadRequestException('Uploaded object is not a decodable image.');
    if ((metadata.pages ?? 1) !== 1) throw new BadRequestException('Animated or multi-page images are not supported.');
    if (metadata.width * metadata.height > this.config.maxPixelCount) throw new BadRequestException('Image pixel count exceeds the configured limit.');
    if (metadata.format !== formats[contentType]) throw new BadRequestException(`Image bytes do not match ${contentType}.`);

    const readyKey = storageKey.replace(/^staging\//, 'ready/');
    const target = this.resolveStorageKey(readyKey);
    const temporary = `${target}.part-${randomUUID()}${extname(target)}`;
    await mkdir(dirname(target), { recursive: true });

    const { data, info } = await sharp(source, { limitInputPixels: this.config.maxPixelCount, animated: false, failOn: 'error' })
      .rotate()
      .toFormat(formats[contentType])
      .toBuffer({ resolveWithObject: true });
    if (data.length > this.config.maxUploadBytes) throw new PayloadTooLargeException('Processed image is too large.');
    await writeFile(temporary, data, { flag: 'wx' });
    await rm(target, { force: true });
    await rename(temporary, target);
    return {
      storageKey: readyKey,
      contentType,
      byteSize: data.length,
      checksumSha256: createHash('sha256').update(data).digest('hex'),
      width: info.width,
      height: info.height
    };
  }

  async delete(storageKey: string): Promise<void> {
    await rm(this.resolveStorageKey(storageKey), { force: true });
  }

  async open(storageKey: string): Promise<{ stream: ReturnType<typeof createReadStream>; byteSize: number }> {
    const path = this.resolveStorageKey(storageKey);
    const file = await stat(path).catch(() => null);
    if (!file?.isFile()) throw new NotFoundException('Media object was not found.');
    return { stream: createReadStream(path), byteSize: file.size };
  }

  private verifyToken(token: string): UploadClaims {
    const separator = token.lastIndexOf('.');
    if (separator <= 0) throw new UnauthorizedException('Invalid upload token.');
    const payload = token.slice(0, separator);
    const actualSignature = Buffer.from(token.slice(separator + 1), 'base64url');
    const expectedSignature = createHmac('sha256', this.config.uploadSecret).update(payload).digest();
    if (actualSignature.length !== expectedSignature.length || !timingSafeEqual(actualSignature, expectedSignature)) {
      throw new UnauthorizedException('Invalid upload token.');
    }

    let claims: UploadClaims;
    try {
      claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as UploadClaims;
    } catch {
      throw new UnauthorizedException('Invalid upload token.');
    }
    if (claims.expiresAtEpochSeconds <= Math.floor(Date.now() / 1000)) throw new UnauthorizedException('Upload token has expired.');
    if (!(claims.contentType in extensions) || claims.maxBytes !== this.config.maxUploadBytes) throw new UnauthorizedException('Invalid upload token.');
    this.resolveStorageKey(claims.storageKey);
    return claims;
  }

  private resolveStorageKey(storageKey: string): string {
    if (!/^(staging|ready)\/(salons|workspaces)\/[A-Za-z0-9_-]+\/[A-Za-z0-9.-]+$/.test(storageKey)) {
      throw new BadRequestException('Invalid storage key.');
    }
    const root = this.config.storageRoot;
    const target = resolve(root, storageKey);
    if (!target.startsWith(`${root}${sep}`)) throw new BadRequestException('Invalid storage key.');
    return target;
  }
}
