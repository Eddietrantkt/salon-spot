import { Body, Controller, Get, Headers, Post, UseGuards } from '@nestjs/common';
import type { AuthenticatedUser, CreateSalonWithWorkspaceResponse, OwnerSalon } from '@salon-spot/contracts';
import { requireIdempotencyKey } from '../../../common/http/idempotency.js';
import { RequestId } from '../../../common/http/request-id.decorator.js';
import { AccessTokenGuard } from '../../auth/presentation/access-token.guard.js';
import { CurrentUser } from '../../auth/presentation/current-user.decorator.js';
import { OwnerSalonsService } from '../application/owner-salons.service.js';
import { CreateSalonWithWorkspaceDto } from './dto/create-salon-with-workspace.dto.js';

/** Authenticated Owner entrypoint. Creating a Salon grants the creator OWNER only for that Salon. */
@Controller('owner/salons')
@UseGuards(AccessTokenGuard)
export class OwnerSalonsController {
  constructor(private readonly salons: OwnerSalonsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser): Promise<OwnerSalon[]> {
    return this.salons.listOwned(user.id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateSalonWithWorkspaceDto,
    @Headers('idempotency-key') idempotencyKey: string | string[] | undefined,
    @RequestId() requestId?: string
  ): Promise<CreateSalonWithWorkspaceResponse> {
    return this.salons.createWithFirstWorkspace(user.id, body, requireIdempotencyKey(idempotencyKey), requestId);
  }
}
