import { Readable } from 'node:stream';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { MediaConfigService } from '../../../common/config/media-config.service.js';
import { MediaStorageService } from './media-storage.service.js';

describe('MediaStorageService', () => {
  let storageRoot: string;
  let storage: MediaStorageService;

  beforeEach(async () => {
    storageRoot = await mkdtemp(join(tmpdir(), 'salon-spot-media-'));
    const config = {
      uploadSecret: 'test-media-upload-secret-with-at-least-32-characters',
      publicBaseUrl: 'http://localhost:3000/api/v1',
      storageRoot,
      uploadTtlSeconds: 900,
      maxUploadBytes: 1_000_000,
      maxPixelCount: 1_000_000
    } as MediaConfigService;
    storage = new MediaStorageService(config);
  });

  afterEach(async () => rm(storageRoot, { recursive: true, force: true }));

  it('accepts a signed upload, decodes it, strips metadata and returns verified READY metadata', async () => {
    const input = await sharp({ create: { width: 8, height: 6, channels: 3, background: '#7a55cc' } })
      .withExif({ IFD0: { Artist: 'must-not-survive' } })
      .jpeg()
      .toBuffer();
    const upload = storage.createUpload('workspace', 'workspace_1', 'image/jpeg');
    const token = upload.url.split('/').at(-1)!;

    await storage.acceptUpload(token, 'image/jpeg', Readable.from(input));
    await expect(storage.acceptUpload(token, 'image/jpeg', Readable.from(input))).rejects.toThrow('Upload token has already been used.');
    const processed = await storage.processImage(upload.storageKey, 'image/jpeg');

    expect(processed).toMatchObject({ contentType: 'image/jpeg', width: 8, height: 6 });
    expect(processed.storageKey).toMatch(/^ready\/workspaces\/workspace_1\//);
    expect(processed.checksumSha256).toMatch(/^[a-f0-9]{64}$/);
    const publicFile = await storage.open(processed.storageKey);
    expect(publicFile.byteSize).toBe(processed.byteSize);
    const chunks: Buffer[] = [];
    for await (const chunk of publicFile.stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array));
    const metadata = await sharp(Buffer.concat(chunks)).metadata();
    expect(metadata.exif).toBeUndefined();
  });

  it('rejects a Content-Type that does not match the signed upload intent', async () => {
    const upload = storage.createUpload('salon', 'salon_1', 'image/png');
    const token = upload.url.split('/').at(-1)!;
    await expect(storage.acceptUpload(token, 'image/jpeg', Readable.from(Buffer.from('not-an-image')))).rejects.toThrow('Content-Type must be image/png');
  });
});
