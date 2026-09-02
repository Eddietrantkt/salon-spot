import { Module, ValidationPipe, type ExecutionContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { API_PREFIX, type MediaUploadIntentResponse } from '@salon-spot/contracts';
import type { AddressInfo } from 'node:net';
import { AccessTokenGuard } from '../src/modules/auth/presentation/access-token.guard.js';
import { OwnerMediaService } from '../src/modules/media/application/owner-media.service.js';
import { MediaStorageService } from '../src/modules/media/application/media-storage.service.js';
import { MediaContentController } from '../src/modules/media/presentation/media-content.controller.js';
import { OwnerSalonMediaController } from '../src/modules/media/presentation/owner-salon-media.controller.js';
import { SalonOwnerGuard } from '../src/modules/salons/presentation/salon-owner.guard.js';
import { RequestIdMiddleware } from '../src/common/http/request-id.middleware.js';

const response: MediaUploadIntentResponse = {
  media: { id: 'media_1', status: 'PENDING_UPLOAD', contentType: 'image/jpeg', byteSize: null, width: null, height: null, sortOrder: 0, isCover: false, url: null, failureReason: null },
  upload: { method: 'PUT', url: 'http://localhost/upload', headers: { 'Content-Type': 'image/jpeg' }, expiresAt: '2026-08-25T01:00:00.000Z', maxBytes: 10_000_000 }
};
const ownerMedia = {
  createSalonUploadIntent: jest.fn(async () => response),
  finalizeSalon: jest.fn(), setSalonCover: jest.fn(), reorderSalon: jest.fn(), deleteSalon: jest.fn()
};
let uploadedBytes = 0;
const mediaStorage = {
  acceptUpload: jest.fn(async (_token: string, _contentType: string, body: AsyncIterable<Buffer>) => {
    uploadedBytes = 0;
    for await (const chunk of body) uploadedBytes += Buffer.byteLength(chunk);
  }),
  open: jest.fn()
};

@Module({
  controllers: [OwnerSalonMediaController, MediaContentController],
  providers: [
    { provide: OwnerMediaService, useValue: ownerMedia },
    { provide: MediaStorageService, useValue: mediaStorage },
    { provide: AccessTokenGuard, useValue: { canActivate: (context: ExecutionContext) => { context.switchToHttp().getRequest().user = { id: 'owner_1', email: 'owner@example.com', displayName: 'Owner' }; return true; } } },
    { provide: SalonOwnerGuard, useValue: { canActivate: () => true } }
  ]
})
class MediaHttpContractTestModule {}

describe('Media HTTP contracts', () => {
  let baseUrl: string;
  let app: Awaited<ReturnType<typeof NestFactory.create>>;

  beforeAll(async () => {
    app = await NestFactory.create(MediaHttpContractTestModule, { logger: false });
    const requestIds = new RequestIdMiddleware();
    app.use(requestIds.use.bind(requestIds));
    app.setGlobalPrefix(API_PREFIX);
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.listen(0, '127.0.0.1');
    baseUrl = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}/${API_PREFIX}`;
  });

  afterAll(async () => app.close());
  beforeEach(() => { jest.clearAllMocks(); uploadedBytes = 0; });

  it('rejects unsupported image types before an upload intent is created', async () => {
    const result = await fetch(`${baseUrl}/owner/salons/salon_1/media/upload-intents`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ contentType: 'image/gif' })
    });
    expect(result.status).toBe(400);
    expect(ownerMedia.createSalonUploadIntent).not.toHaveBeenCalled();
  });

  it('passes the authenticated actor and validated allowlisted type to the service', async () => {
    const result = await fetch(`${baseUrl}/owner/salons/salon_1/media/upload-intents`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ contentType: 'image/jpeg' })
    });
    expect(result.status).toBe(201);
    await expect(result.json()).resolves.toEqual(response);
    expect(ownerMedia.createSalonUploadIntent).toHaveBeenCalledWith('salon_1', 'owner_1', { contentType: 'image/jpeg' }, expect.any(String));
  });

  it('leaves image request bodies as a raw stream for signed PUT storage', async () => {
    const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
    const result = await fetch(`${baseUrl}/media/uploads/signed-token`, {
      method: 'PUT', headers: { 'content-type': 'image/jpeg' }, body: bytes
    });
    expect(result.status).toBe(204);
    expect(uploadedBytes).toBe(bytes.length);
    expect(mediaStorage.acceptUpload).toHaveBeenCalledWith('signed-token', 'image/jpeg', expect.anything());
  });
});
