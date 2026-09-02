import { Controller, Get, Headers, Param, Post, Query, UseGuards } from '@nestjs/common';
import type { AuthenticatedUser, CreateSlotHoldResponse, MyHoldsResponse, WorkspaceDetailResponse } from '@salon-spot/contracts';
import { requireIdempotencyKey } from '../../../common/http/idempotency.js';
import { RequestId } from '../../../common/http/request-id.decorator.js';
import { AccessTokenGuard } from '../../auth/presentation/access-token.guard.js';
import { CurrentUser } from '../../auth/presentation/current-user.decorator.js';
import { ProfessionalGuard } from '../../professionals/presentation/professional.guard.js';
import { PublicWorkspaceDetailService } from '../application/public-workspace-detail.service.js';
import { SlotHoldsService } from '../application/slot-holds.service.js';
import { PublicWorkspaceDetailQueryDto } from './dto/public-workspace-detail.query.js';

@Controller()
export class PublicAvailabilityController {
  constructor(private readonly detail: PublicWorkspaceDetailService, private readonly holds: SlotHoldsService) {}

  @Get('workspaces/:workspaceId')
  getWorkspace(@Param('workspaceId') workspaceId: string, @Query() query: PublicWorkspaceDetailQueryDto): Promise<WorkspaceDetailResponse> {
    return this.detail.get(workspaceId, query.date);
  }

  @UseGuards(AccessTokenGuard, ProfessionalGuard)
  @Post('availability/slots/:slotId/holds')
  createHold(
    @Param('slotId') slotId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Headers('idempotency-key') idempotencyKey: string | string[] | undefined,
    @RequestId() requestId?: string
  ): Promise<CreateSlotHoldResponse> {
    return this.holds.create(user.id, slotId, requireIdempotencyKey(idempotencyKey), requestId);
  }

  @UseGuards(AccessTokenGuard, ProfessionalGuard)
  @Get('me/holds')
  getMyHolds(@CurrentUser() user: AuthenticatedUser): Promise<MyHoldsResponse> {
    return this.holds.getMine(user.id);
  }
}
