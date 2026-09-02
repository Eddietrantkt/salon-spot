import { Controller, Get, Headers, HttpCode, Param, Put, Req, Res, StreamableFile } from '@nestjs/common';
import type { Readable } from 'node:stream';
import { MediaStorageService } from '../application/media-storage.service.js';
import { OwnerMediaService } from '../application/owner-media.service.js';

interface ResponseHeaders {
  setHeader(name: string, value: string | number): void;
}

@Controller('media')
export class MediaContentController {
  constructor(private readonly media: OwnerMediaService, private readonly storage: MediaStorageService) {}

  @Put('uploads/:token')
  @HttpCode(204)
  async upload(
    @Param('token') token: string,
    @Headers('content-type') contentType: string | undefined,
    @Req() request: Readable
  ): Promise<void> {
    await this.storage.acceptUpload(token, contentType, request);
  }

  @Get('salons/:mediaId')
  getSalonMedia(@Param('mediaId') mediaId: string, @Res({ passthrough: true }) response: ResponseHeaders): Promise<StreamableFile> {
    return this.getContent('salon', mediaId, response);
  }

  @Get('workspaces/:mediaId')
  getWorkspaceMedia(@Param('mediaId') mediaId: string, @Res({ passthrough: true }) response: ResponseHeaders): Promise<StreamableFile> {
    return this.getContent('workspace', mediaId, response);
  }

  private async getContent(kind: 'salon' | 'workspace', mediaId: string, response: ResponseHeaders): Promise<StreamableFile> {
    const media = await this.media.getPublic(kind, mediaId);
    const file = await this.storage.open(media.storageKey);
    response.setHeader('Content-Type', media.contentType);
    response.setHeader('Content-Length', file.byteSize);
    response.setHeader('Cache-Control', 'public, max-age=86400, immutable');
    return new StreamableFile(file.stream);
  }
}
