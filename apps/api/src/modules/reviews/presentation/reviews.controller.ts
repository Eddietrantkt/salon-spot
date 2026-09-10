import { Body, Controller, Get, Headers, Param, Post, Query, UseGuards } from '@nestjs/common';
import type { AuthenticatedUser, CreateSalonReviewResponse, SalonReviewsResponse } from '@salon-spot/contracts';
import { requireIdempotencyKey } from '../../../common/http/idempotency.js';
import { AccessTokenGuard } from '../../auth/presentation/access-token.guard.js';
import { CurrentUser } from '../../auth/presentation/current-user.decorator.js';
import { ProfessionalGuard } from '../../professionals/presentation/professional.guard.js';
import { ReviewsService } from '../application/reviews.service.js';
import { CreateSalonReviewDto } from './dto/create-salon-review.dto.js';
import { SalonReviewQueryDto } from './dto/salon-review-query.dto.js';

@Controller('bookings')
@UseGuards(AccessTokenGuard, ProfessionalGuard)
export class BookingReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Post(':bookingId/reviews')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('bookingId') bookingId: string,
    @Body() body: CreateSalonReviewDto,
    @Headers('idempotency-key') idempotencyKey: string | string[] | undefined,
    @Headers('x-request-id') requestId?: string
  ): Promise<CreateSalonReviewResponse> {
    return this.reviews.create(user.id, bookingId, body, requireIdempotencyKey(idempotencyKey), requestId);
  }
}

@Controller('salons')
export class PublicSalonReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get(':salonId/reviews')
  list(@Param('salonId') salonId: string, @Query() query: SalonReviewQueryDto): Promise<SalonReviewsResponse> {
    return this.reviews.listPublished(salonId, query);
  }
}
