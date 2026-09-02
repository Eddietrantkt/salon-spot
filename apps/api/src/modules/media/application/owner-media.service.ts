import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { MediaStatus, Prisma, type SalonMedia, type WorkspaceMedia } from '@prisma/client';
import type {
  CreateMediaUploadIntentInput,
  MediaUploadIntentResponse,
  OwnerMedia,
  ReorderMediaInput,
  SetMediaCoverInput
} from '@salon-spot/contracts';
import { PrismaService } from '../../../common/database/prisma/prisma.service.js';
import { MediaConfigService } from '../../../common/config/media-config.service.js';
import { MediaStorageService, type AllowedMediaType, type MediaParentKind } from './media-storage.service.js';

const MAX_MEDIA_PER_PARENT = 10;
const IMAGE_PROCESSING_FAILURE_MESSAGE = 'The image is invalid or could not be processed. Please choose a different JPEG, PNG, or WebP image.';
const activeStatuses: MediaStatus[] = [
  MediaStatus.PENDING_UPLOAD,
  MediaStatus.PROCESSING,
  MediaStatus.READY,
  MediaStatus.DELETE_PENDING
];

type MediaRecord = Pick<SalonMedia | WorkspaceMedia,
  'id' | 'status' | 'contentType' | 'byteSize' | 'width' | 'height' | 'sortOrder' | 'failureReason' | 'storageKey' | 'uploadExpiresAt'>;

@Injectable()
export class OwnerMediaService {
  private readonly logger = new Logger(OwnerMediaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: MediaStorageService,
    private readonly config: MediaConfigService
  ) {}

  createSalonUploadIntent(
    salonId: string,
    actorUserId: string,
    input: CreateMediaUploadIntentInput,
    requestId?: string
  ): Promise<MediaUploadIntentResponse> {
    return this.createUploadIntent('salon', salonId, salonId, actorUserId, input.contentType, requestId);
  }

  async createWorkspaceUploadIntent(
    salonId: string,
    workspaceId: string,
    actorUserId: string,
    input: CreateMediaUploadIntentInput,
    requestId?: string
  ): Promise<MediaUploadIntentResponse> {
    await this.assertWorkspaceInSalon(workspaceId, salonId);
    return this.createUploadIntent('workspace', workspaceId, salonId, actorUserId, input.contentType, requestId);
  }

  finalizeSalon(salonId: string, mediaId: string, actorUserId: string, requestId?: string): Promise<OwnerMedia> {
    return this.finalize('salon', salonId, mediaId, actorUserId, requestId);
  }

  async finalizeWorkspace(
    salonId: string,
    workspaceId: string,
    mediaId: string,
    actorUserId: string,
    requestId?: string
  ): Promise<OwnerMedia> {
    await this.assertWorkspaceInSalon(workspaceId, salonId);
    return this.finalize('workspace', workspaceId, mediaId, actorUserId, requestId);
  }

  setSalonCover(salonId: string, actorUserId: string, input: SetMediaCoverInput, requestId?: string): Promise<OwnerMedia | null> {
    return this.setCover('salon', salonId, actorUserId, input.mediaId, requestId);
  }

  async setWorkspaceCover(
    salonId: string,
    workspaceId: string,
    actorUserId: string,
    input: SetMediaCoverInput,
    requestId?: string
  ): Promise<OwnerMedia | null> {
    await this.assertWorkspaceInSalon(workspaceId, salonId);
    return this.setCover('workspace', workspaceId, actorUserId, input.mediaId, requestId);
  }

  reorderSalon(salonId: string, actorUserId: string, input: ReorderMediaInput, requestId?: string): Promise<OwnerMedia[]> {
    return this.reorder('salon', salonId, actorUserId, input.mediaIds, requestId);
  }

  async reorderWorkspace(
    salonId: string,
    workspaceId: string,
    actorUserId: string,
    input: ReorderMediaInput,
    requestId?: string
  ): Promise<OwnerMedia[]> {
    await this.assertWorkspaceInSalon(workspaceId, salonId);
    return this.reorder('workspace', workspaceId, actorUserId, input.mediaIds, requestId);
  }

  deleteSalon(salonId: string, mediaId: string, actorUserId: string, requestId?: string): Promise<OwnerMedia> {
    return this.deleteMedia('salon', salonId, mediaId, actorUserId, requestId);
  }

  async deleteWorkspace(
    salonId: string,
    workspaceId: string,
    mediaId: string,
    actorUserId: string,
    requestId?: string
  ): Promise<OwnerMedia> {
    await this.assertWorkspaceInSalon(workspaceId, salonId);
    return this.deleteMedia('workspace', workspaceId, mediaId, actorUserId, requestId);
  }

  async getPublic(kind: MediaParentKind, mediaId: string): Promise<{ storageKey: string; contentType: string }> {
    const media = kind === 'salon'
      ? await this.prisma.salonMedia.findFirst({ where: { id: mediaId, status: MediaStatus.READY }, select: { storageKey: true, contentType: true } })
      : await this.prisma.workspaceMedia.findFirst({ where: { id: mediaId, status: MediaStatus.READY }, select: { storageKey: true, contentType: true } });
    if (!media) throw new NotFoundException('Media is not public.');
    return media;
  }

  private async createUploadIntent(
    kind: MediaParentKind,
    parentId: string,
    salonId: string,
    actorUserId: string,
    contentType: AllowedMediaType,
    requestId?: string
  ): Promise<MediaUploadIntentResponse> {
    const upload = this.storage.createUpload(kind, parentId, contentType);
    const media = await this.prisma.$transaction(async (tx) => {
      await this.lockParent(tx, kind, parentId);
      const count = kind === 'salon'
        ? await tx.salonMedia.count({ where: { salonId: parentId, status: { in: activeStatuses } } })
        : await tx.workspaceMedia.count({ where: { workspaceId: parentId, status: { in: activeStatuses } } });
      if (count >= MAX_MEDIA_PER_PARENT) throw new ConflictException(`A ${kind} can have at most ${MAX_MEDIA_PER_PARENT} active images.`);

      const aggregate = kind === 'salon'
        ? await tx.salonMedia.aggregate({ where: { salonId: parentId, status: { in: activeStatuses } }, _max: { sortOrder: true } })
        : await tx.workspaceMedia.aggregate({ where: { workspaceId: parentId, status: { in: activeStatuses } }, _max: { sortOrder: true } });
      const sortOrder = (aggregate._max.sortOrder ?? -1) + 1;
      const created = kind === 'salon'
        ? await tx.salonMedia.create({ data: { salonId: parentId, storageKey: upload.storageKey, contentType, sortOrder, uploadExpiresAt: upload.expiresAt } })
        : await tx.workspaceMedia.create({ data: { workspaceId: parentId, storageKey: upload.storageKey, contentType, sortOrder, uploadExpiresAt: upload.expiresAt } });
      await tx.auditEvent.create({
        data: { actorUserId, entityType: this.entityType(kind), entityId: created.id, action: 'MEDIA_UPLOAD_INTENT_CREATED', requestId, after: { salonId, parentId, contentType } }
      });
      return created;
    });

    return {
      media: this.toOwnerMedia(kind, media, false),
      upload: {
        method: 'PUT',
        url: upload.url,
        headers: { 'Content-Type': contentType },
        expiresAt: upload.expiresAt.toISOString(),
        maxBytes: this.config.maxUploadBytes
      }
    };
  }

  private async finalize(
    kind: MediaParentKind,
    parentId: string,
    mediaId: string,
    actorUserId: string,
    requestId?: string
  ): Promise<OwnerMedia> {
    const media = await this.findOwnedMedia(kind, parentId, mediaId);
    if (media.status === MediaStatus.READY) return this.toOwnerMedia(kind, media, await this.isCover(kind, parentId, media.id));
    if (media.status !== MediaStatus.PENDING_UPLOAD) throw new ConflictException(`Media in ${media.status} state cannot be finalized.`);

    const claimed = kind === 'salon'
      ? await this.prisma.salonMedia.updateMany({ where: { id: mediaId, salonId: parentId, status: MediaStatus.PENDING_UPLOAD }, data: { status: MediaStatus.PROCESSING, failureReason: null } })
      : await this.prisma.workspaceMedia.updateMany({ where: { id: mediaId, workspaceId: parentId, status: MediaStatus.PENDING_UPLOAD }, data: { status: MediaStatus.PROCESSING, failureReason: null } });
    if (claimed.count !== 1) throw new ConflictException('Media finalization is already in progress.');

    let processed: Awaited<ReturnType<MediaStorageService['processImage']>>;
    try {
      processed = await this.storage.processImage(media.storageKey, media.contentType);
    } catch (error) {
      this.logger.error(
        `Media processing failed for mediaId=${mediaId}, requestId=${requestId ?? 'unknown'}.`,
        error instanceof Error ? error.stack ?? error.message : undefined
      );
      await this.prisma.$transaction(async (tx) => {
        if (kind === 'salon') await tx.salonMedia.update({ where: { id: mediaId }, data: { status: MediaStatus.REJECTED, failureReason: IMAGE_PROCESSING_FAILURE_MESSAGE, uploadExpiresAt: null } });
        else await tx.workspaceMedia.update({ where: { id: mediaId }, data: { status: MediaStatus.REJECTED, failureReason: IMAGE_PROCESSING_FAILURE_MESSAGE, uploadExpiresAt: null } });
        await tx.auditEvent.create({ data: { actorUserId, entityType: this.entityType(kind), entityId: mediaId, action: 'MEDIA_REJECTED', requestId, after: { reason: IMAGE_PROCESSING_FAILURE_MESSAGE } } });
        await tx.outboxEvent.create({ data: { topic: 'MEDIA_STORAGE_CLEANUP_REQUESTED', payload: { kind, mediaId, storageKey: media.storageKey }, availableAt: media.uploadExpiresAt ?? new Date() } });
      });
      throw new BadRequestException(IMAGE_PROCESSING_FAILURE_MESSAGE);
    }

    try {
      const ready = await this.prisma.$transaction(async (tx) => {
        await this.lockParent(tx, kind, parentId);
        const updatedCount = kind === 'salon'
          ? await tx.salonMedia.updateMany({ where: { id: mediaId, salonId: parentId, status: MediaStatus.PROCESSING }, data: { ...processed, status: MediaStatus.READY, failureReason: null, uploadExpiresAt: null } })
          : await tx.workspaceMedia.updateMany({ where: { id: mediaId, workspaceId: parentId, status: MediaStatus.PROCESSING }, data: { ...processed, status: MediaStatus.READY, failureReason: null, uploadExpiresAt: null } });
        if (updatedCount.count !== 1) throw new ConflictException('Media state changed while finalization was running.');
        const updated = kind === 'salon'
          ? await tx.salonMedia.findUniqueOrThrow({ where: { id: mediaId } })
          : await tx.workspaceMedia.findUniqueOrThrow({ where: { id: mediaId } });
        await tx.auditEvent.create({
          data: { actorUserId, entityType: this.entityType(kind), entityId: mediaId, action: 'MEDIA_READY', requestId, after: { byteSize: processed.byteSize, width: processed.width, height: processed.height, checksumSha256: processed.checksumSha256 } }
        });
        await tx.outboxEvent.create({ data: { topic: 'MEDIA_STORAGE_CLEANUP_REQUESTED', payload: { kind, mediaId, storageKey: media.storageKey }, availableAt: media.uploadExpiresAt ?? new Date() } });
        return updated;
      });
      return this.toOwnerMedia(kind, ready, false);
    } catch (error) {
      await this.storage.delete(processed.storageKey).catch(() => undefined);
      if (kind === 'salon') await this.prisma.salonMedia.updateMany({ where: { id: mediaId, status: MediaStatus.PROCESSING }, data: { status: MediaStatus.PENDING_UPLOAD } }).catch(() => undefined);
      else await this.prisma.workspaceMedia.updateMany({ where: { id: mediaId, status: MediaStatus.PROCESSING }, data: { status: MediaStatus.PENDING_UPLOAD } }).catch(() => undefined);
      throw error;
    }
  }

  private async setCover(
    kind: MediaParentKind,
    parentId: string,
    actorUserId: string,
    mediaId: string | null,
    requestId?: string
  ): Promise<OwnerMedia | null> {
    return this.prisma.$transaction(async (tx) => {
      await this.lockParent(tx, kind, parentId);
      let media: MediaRecord | null = null;
      if (mediaId) {
        media = kind === 'salon'
          ? await tx.salonMedia.findFirst({ where: { id: mediaId, salonId: parentId, status: MediaStatus.READY } })
          : await tx.workspaceMedia.findFirst({ where: { id: mediaId, workspaceId: parentId, status: MediaStatus.READY } });
        if (!media) throw new BadRequestException('Cover must be READY media owned by this parent.');
      }
      if (kind === 'salon') await tx.salon.update({ where: { id: parentId }, data: { coverMediaId: mediaId } });
      else await tx.workspace.update({ where: { id: parentId }, data: { coverMediaId: mediaId } });
      await tx.auditEvent.create({ data: { actorUserId, entityType: kind === 'salon' ? 'Salon' : 'Workspace', entityId: parentId, action: 'MEDIA_COVER_CHANGED', requestId, after: { coverMediaId: mediaId } } });
      return media ? this.toOwnerMedia(kind, media, true) : null;
    });
  }

  private async reorder(
    kind: MediaParentKind,
    parentId: string,
    actorUserId: string,
    mediaIds: string[],
    requestId?: string
  ): Promise<OwnerMedia[]> {
    return this.prisma.$transaction(async (tx) => {
      await this.lockParent(tx, kind, parentId);
      const current = kind === 'salon'
        ? await tx.salonMedia.findMany({ where: { salonId: parentId, status: MediaStatus.READY }, orderBy: { sortOrder: 'asc' } })
        : await tx.workspaceMedia.findMany({ where: { workspaceId: parentId, status: MediaStatus.READY }, orderBy: { sortOrder: 'asc' } });
      if (current.length !== mediaIds.length || current.some((media) => !mediaIds.includes(media.id))) {
        throw new BadRequestException('mediaIds must contain every READY media ID for this parent exactly once.');
      }
      for (const [sortOrder, id] of mediaIds.entries()) {
        if (kind === 'salon') await tx.salonMedia.update({ where: { id }, data: { sortOrder } });
        else await tx.workspaceMedia.update({ where: { id }, data: { sortOrder } });
      }
      await tx.auditEvent.create({ data: { actorUserId, entityType: kind === 'salon' ? 'Salon' : 'Workspace', entityId: parentId, action: 'MEDIA_REORDERED', requestId, after: { mediaIds } } });
      const coverMediaId = kind === 'salon'
        ? (await tx.salon.findUniqueOrThrow({ where: { id: parentId }, select: { coverMediaId: true } })).coverMediaId
        : (await tx.workspace.findUniqueOrThrow({ where: { id: parentId }, select: { coverMediaId: true } })).coverMediaId;
      return mediaIds.map((id, sortOrder) => this.toOwnerMedia(kind, { ...current.find((media) => media.id === id)!, sortOrder }, id === coverMediaId));
    });
  }

  private async deleteMedia(
    kind: MediaParentKind,
    parentId: string,
    mediaId: string,
    actorUserId: string,
    requestId?: string
  ): Promise<OwnerMedia> {
    return this.prisma.$transaction(async (tx) => {
      await this.lockParent(tx, kind, parentId);
      const media = kind === 'salon'
        ? await tx.salonMedia.findFirst({ where: { id: mediaId, salonId: parentId } })
        : await tx.workspaceMedia.findFirst({ where: { id: mediaId, workspaceId: parentId } });
      if (!media) throw new NotFoundException('Media was not found for this parent.');
      if (media.status === MediaStatus.DELETED || media.status === MediaStatus.DELETE_PENDING) return this.toOwnerMedia(kind, media, false);

      if (kind === 'salon') {
        await tx.salon.updateMany({ where: { id: parentId, coverMediaId: mediaId }, data: { coverMediaId: null } });
        await tx.salonMedia.update({ where: { id: mediaId }, data: { status: MediaStatus.DELETE_PENDING } });
      } else {
        await tx.workspace.updateMany({ where: { id: parentId, coverMediaId: mediaId }, data: { coverMediaId: null } });
        await tx.workspaceMedia.update({ where: { id: mediaId }, data: { status: MediaStatus.DELETE_PENDING } });
      }
      await tx.outboxEvent.create({
        data: {
          topic: 'MEDIA_DELETE_REQUESTED',
          payload: { kind, mediaId, storageKey: media.storageKey },
          availableAt: media.uploadExpiresAt && media.uploadExpiresAt > new Date() ? media.uploadExpiresAt : new Date()
        }
      });
      await tx.auditEvent.create({ data: { actorUserId, entityType: this.entityType(kind), entityId: mediaId, action: 'MEDIA_DELETE_REQUESTED', requestId } });
      return this.toOwnerMedia(kind, { ...media, status: MediaStatus.DELETE_PENDING }, false);
    });
  }

  private async findOwnedMedia(kind: MediaParentKind, parentId: string, mediaId: string): Promise<MediaRecord> {
    const media = kind === 'salon'
      ? await this.prisma.salonMedia.findFirst({ where: { id: mediaId, salonId: parentId } })
      : await this.prisma.workspaceMedia.findFirst({ where: { id: mediaId, workspaceId: parentId } });
    if (!media) throw new NotFoundException('Media was not found for this parent.');
    return media;
  }

  private async isCover(kind: MediaParentKind, parentId: string, mediaId: string): Promise<boolean> {
    const parent = kind === 'salon'
      ? await this.prisma.salon.findFirst({ where: { id: parentId, coverMediaId: mediaId }, select: { id: true } })
      : await this.prisma.workspace.findFirst({ where: { id: parentId, coverMediaId: mediaId }, select: { id: true } });
    return Boolean(parent);
  }

  private async assertWorkspaceInSalon(workspaceId: string, salonId: string): Promise<void> {
    const workspace = await this.prisma.workspace.findFirst({ where: { id: workspaceId, salonId }, select: { id: true } });
    if (!workspace) throw new NotFoundException('Workspace was not found in this Salon.');
  }

  private async lockParent(tx: Prisma.TransactionClient, kind: MediaParentKind, parentId: string): Promise<void> {
    const rows = kind === 'salon'
      ? await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT id FROM Salon WHERE id = ${parentId} FOR UPDATE`)
      : await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT id FROM Workspace WHERE id = ${parentId} FOR UPDATE`);
    if (rows.length !== 1) throw new NotFoundException(`${kind === 'salon' ? 'Salon' : 'Workspace'} was not found.`);
  }

  private toOwnerMedia(kind: MediaParentKind, media: MediaRecord, isCover: boolean): OwnerMedia {
    return {
      id: media.id,
      status: media.status,
      contentType: media.contentType,
      byteSize: media.byteSize,
      width: media.width,
      height: media.height,
      sortOrder: media.sortOrder,
      isCover,
      url: media.status === MediaStatus.READY ? `${this.config.publicBaseUrl}/media/${kind}s/${media.id}` : null,
      failureReason: media.failureReason
    };
  }

  private entityType(kind: MediaParentKind): 'SalonMedia' | 'WorkspaceMedia' {
    return kind === 'salon' ? 'SalonMedia' : 'WorkspaceMedia';
  }
}
