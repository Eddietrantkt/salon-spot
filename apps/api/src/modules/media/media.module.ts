import { Module } from '@nestjs/common';
import { SalonsModule } from '../salons/salons.module.js';
import { MediaStorageService } from './application/media-storage.service.js';
import { MediaCleanupService } from './application/media-cleanup.service.js';
import { OwnerMediaService } from './application/owner-media.service.js';
import { MediaContentController } from './presentation/media-content.controller.js';
import { OwnerSalonMediaController } from './presentation/owner-salon-media.controller.js';
import { OwnerWorkspaceMediaController } from './presentation/owner-workspace-media.controller.js';

/** Owns media metadata, visibility and finalization after object-storage upload. */
@Module({
  imports: [SalonsModule],
  controllers: [MediaContentController, OwnerSalonMediaController, OwnerWorkspaceMediaController],
  providers: [MediaStorageService, MediaCleanupService, OwnerMediaService],
  exports: [MediaStorageService, MediaCleanupService]
})
export class MediaModule {}
