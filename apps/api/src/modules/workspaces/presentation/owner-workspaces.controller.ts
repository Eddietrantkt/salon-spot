import { Body, Controller, Get, Headers, Param, Post, UseGuards } from '@nestjs/common';
import type { AuthenticatedUser, CreateWorkspaceResponse, WorkspacePublishChecklistResponse } from '@salon-spot/contracts';
import { requireIdempotencyKey } from '../../../common/http/idempotency.js';
import { RequestId } from '../../../common/http/request-id.decorator.js';
import { AccessTokenGuard } from '../../auth/presentation/access-token.guard.js';
import { CurrentUser } from '../../auth/presentation/current-user.decorator.js';
import { SalonOwnerGuard } from '../../salons/presentation/salon-owner.guard.js';
import { OwnerWorkspacesService } from '../application/owner-workspaces.service.js';
import { WorkspacePublishingService } from '../application/workspace-publishing.service.js';
import { CreateWorkspaceDto } from './dto/create-workspace.dto.js';

@Controller('owner/salons/:salonId/workspaces')
@UseGuards(AccessTokenGuard, SalonOwnerGuard)
export class OwnerWorkspacesController {
  constructor(private readonly workspaces: OwnerWorkspacesService, private readonly publishing: WorkspacePublishingService) {}

  @Post()
  create(
    @Param('salonId') salonId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateWorkspaceDto,
    @Headers('idempotency-key') idempotencyKey: string | string[] | undefined,
    @RequestId() requestId?: string
  ): Promise<CreateWorkspaceResponse> {
    return this.workspaces.create(salonId, user.id, body, requireIdempotencyKey(idempotencyKey), requestId);
  }

  @Get(':workspaceId/publish-checklist')
  checklist(
    @Param('salonId') salonId: string,
    @Param('workspaceId') workspaceId: string
  ): Promise<WorkspacePublishChecklistResponse> {
    return this.publishing.checklist(salonId, workspaceId);
  }

  @Post(':workspaceId/publish')
  publish(
    @Param('salonId') salonId: string,
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: AuthenticatedUser,
    @RequestId() requestId?: string
  ): Promise<CreateWorkspaceResponse> {
    return this.publishing.publish(salonId, workspaceId, user.id, requestId);
  }
}
