import { Body, Controller, Delete, Param, Post, Put, UseGuards } from '@nestjs/common';
import type { AuthenticatedUser, MediaUploadIntentResponse, OwnerMedia } from '@salon-spot/contracts';
import { RequestId } from '../../../common/http/request-id.decorator.js';
import { AccessTokenGuard } from '../../auth/presentation/access-token.guard.js';
import { CurrentUser } from '../../auth/presentation/current-user.decorator.js';
import { SalonOwnerGuard } from '../../salons/presentation/salon-owner.guard.js';
import { OwnerMediaService } from '../application/owner-media.service.js';
import { CreateMediaUploadIntentDto } from './dto/create-media-upload-intent.dto.js';
import { ReorderMediaDto } from './dto/reorder-media.dto.js';
import { SetMediaCoverDto } from './dto/set-media-cover.dto.js';

@Controller('owner/salons/:salonId/media')
@UseGuards(AccessTokenGuard, SalonOwnerGuard)
export class OwnerSalonMediaController {
  constructor(private readonly media: OwnerMediaService) {}

  @Post('upload-intents')
  createUploadIntent(
    @Param('salonId') salonId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateMediaUploadIntentDto,
    @RequestId() requestId?: string
  ): Promise<MediaUploadIntentResponse> {
    return this.media.createSalonUploadIntent(salonId, user.id, body, requestId);
  }

  @Post(':mediaId/finalize')
  finalize(
    @Param('salonId') salonId: string,
    @Param('mediaId') mediaId: string,
    @CurrentUser() user: AuthenticatedUser,
    @RequestId() requestId?: string
  ): Promise<OwnerMedia> {
    return this.media.finalizeSalon(salonId, mediaId, user.id, requestId);
  }

  @Put('cover')
  setCover(
    @Param('salonId') salonId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: SetMediaCoverDto,
    @RequestId() requestId?: string
  ): Promise<OwnerMedia | null> {
    return this.media.setSalonCover(salonId, user.id, body, requestId);
  }

  @Put('order')
  reorder(
    @Param('salonId') salonId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: ReorderMediaDto,
    @RequestId() requestId?: string
  ): Promise<OwnerMedia[]> {
    return this.media.reorderSalon(salonId, user.id, body, requestId);
  }

  @Delete(':mediaId')
  delete(
    @Param('salonId') salonId: string,
    @Param('mediaId') mediaId: string,
    @CurrentUser() user: AuthenticatedUser,
    @RequestId() requestId?: string
  ): Promise<OwnerMedia> {
    return this.media.deleteSalon(salonId, mediaId, user.id, requestId);
  }
}
