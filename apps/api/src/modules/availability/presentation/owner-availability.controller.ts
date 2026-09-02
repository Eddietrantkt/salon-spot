import { Body, Controller, Get, Headers, Param, Post, Query, UseGuards } from '@nestjs/common';
import type {
  AuthenticatedUser,
  BlockWorkspaceSlotsResponse,
  OpenWorkspaceSlotsResponse,
  OwnerWorkspaceScheduleResponse
} from '@salon-spot/contracts';
import { requireIdempotencyKey } from '../../../common/http/idempotency.js';
import { RequestId } from '../../../common/http/request-id.decorator.js';
import { AccessTokenGuard } from '../../auth/presentation/access-token.guard.js';
import { CurrentUser } from '../../auth/presentation/current-user.decorator.js';
import { SalonOwnerGuard } from '../../salons/presentation/salon-owner.guard.js';
import { OwnerAvailabilityService } from '../application/owner-availability.service.js';
import { FixedSlotsDateQueryDto, ManageFixedSlotsDto } from './dto/open-fixed-slots.dto.js';

@Controller('owner/salons/:salonId/workspaces/:workspaceId/availability')
@UseGuards(AccessTokenGuard, SalonOwnerGuard)
export class OwnerAvailabilityController {
  constructor(private readonly availability: OwnerAvailabilityService) {}

  @Get('fixed-slots')
  getSchedule(
    @Param('salonId') salonId: string,
    @Param('workspaceId') workspaceId: string,
    @Query() query: FixedSlotsDateQueryDto
  ): Promise<OwnerWorkspaceScheduleResponse> {
    return this.availability.getSchedule(salonId, workspaceId, query.localDate);
  }

  @Post('open-fixed-slots')
  openFixedSlots(
    @Param('salonId') salonId: string,
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: ManageFixedSlotsDto,
    @Headers('idempotency-key') idempotencyKey: string | string[] | undefined,
    @RequestId() requestId?: string
  ): Promise<OpenWorkspaceSlotsResponse> {
    return this.availability.openFixedSlots(salonId, workspaceId, user.id, body, requireIdempotencyKey(idempotencyKey), requestId);
  }

  @Post('block-fixed-slots')
  blockFixedSlots(
    @Param('salonId') salonId: string,
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: ManageFixedSlotsDto,
    @Headers('idempotency-key') idempotencyKey: string | string[] | undefined,
    @RequestId() requestId?: string
  ): Promise<BlockWorkspaceSlotsResponse> {
    return this.availability.blockFixedSlots(salonId, workspaceId, user.id, body, requireIdempotencyKey(idempotencyKey), requestId);
  }
}
