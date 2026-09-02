import { Controller, Get, Headers, Param, Post, UseGuards } from '@nestjs/common';
import type { AuthenticatedUser, BookingDetailResponse, CancelBookingResponse, ConfirmHoldResponse, MyBookingsResponse } from '@salon-spot/contracts';
import { requireIdempotencyKey } from '../../../common/http/idempotency.js';
import { RequestId } from '../../../common/http/request-id.decorator.js';
import { AccessTokenGuard } from '../../auth/presentation/access-token.guard.js';
import { CurrentUser } from '../../auth/presentation/current-user.decorator.js';
import { ProfessionalGuard } from '../../professionals/presentation/professional.guard.js';
import { BookingsService } from '../application/bookings.service.js';

@Controller()
@UseGuards(AccessTokenGuard, ProfessionalGuard)
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Post('holds/:holdId/confirm')
  confirm(@Param('holdId') holdId: string, @CurrentUser() user: AuthenticatedUser, @Headers('idempotency-key') idempotencyKey: string | string[] | undefined, @RequestId() requestId?: string): Promise<ConfirmHoldResponse> {
    return this.bookings.confirm(user.id, holdId, requireIdempotencyKey(idempotencyKey), requestId);
  }

  @Get('me/bookings')
  getMine(@CurrentUser() user: AuthenticatedUser): Promise<MyBookingsResponse> {
    return this.bookings.getMine(user.id);
  }

  @Get('me/bookings/:bookingId')
  getOne(@CurrentUser() user: AuthenticatedUser, @Param('bookingId') bookingId: string): Promise<BookingDetailResponse> {
    return this.bookings.getMineById(user.id, bookingId);
  }

  @Post('bookings/:bookingId/cancel')
  cancel(@Param('bookingId') bookingId: string, @CurrentUser() user: AuthenticatedUser, @Headers('idempotency-key') idempotencyKey: string | string[] | undefined, @RequestId() requestId?: string): Promise<CancelBookingResponse> {
    return this.bookings.cancel(user.id, bookingId, requireIdempotencyKey(idempotencyKey), requestId);
  }
}
