import { Body, Controller, Get, Headers, Param, Put, Query, UseGuards } from '@nestjs/common';
import type { AdminAuditEventsResponse, AdminOutboxEventsResponse, AdminOverviewResponse, AdminUsersResponse, AuthenticatedUser, UpdateAdminUserStatusResponse } from '@salon-spot/contracts';
import { requireIdempotencyKey } from '../../../common/http/idempotency.js';
import { RequestId } from '../../../common/http/request-id.decorator.js';
import { AccessTokenGuard } from '../../auth/presentation/access-token.guard.js';
import { CurrentUser } from '../../auth/presentation/current-user.decorator.js';
import { AdminOperationsService } from '../application/admin-operations.service.js';
import { AdminGuard } from './admin.guard.js';
import { AdminUserQuery } from './dto/admin-user-query.dto.js';
import { UpdateUserStatusDto } from './dto/update-user-status.dto.js';

@Controller('admin')
@UseGuards(AccessTokenGuard, AdminGuard)
export class AdminController {
  constructor(private readonly operations: AdminOperationsService) {}

  @Get('overview')
  overview(): Promise<AdminOverviewResponse> {
    return this.operations.getOverview();
  }

  @Get('users')
  users(@Query() query: AdminUserQuery): Promise<AdminUsersResponse> {
    return this.operations.listUsers(query);
  }

  @Put('users/:userId/status')
  updateUserStatus(
    @Param('userId') userId: string,
    @Body() body: UpdateUserStatusDto,
    @CurrentUser() user: AuthenticatedUser,
    @Headers('idempotency-key') idempotencyKey: string | string[] | undefined,
    @RequestId() requestId?: string
  ): Promise<UpdateAdminUserStatusResponse> {
    return this.operations.updateUserStatus(user.id, userId, body, requireIdempotencyKey(idempotencyKey), requestId);
  }

  @Get('audit-events')
  auditEvents(): Promise<AdminAuditEventsResponse> {
    return this.operations.listAuditEvents();
  }

  @Get('outbox-events')
  outboxEvents(): Promise<AdminOutboxEventsResponse> {
    return this.operations.listOutboxEvents();
  }
}
