import { Module, ValidationPipe } from '@nestjs/common';
import { APP_FILTER, NestFactory } from '@nestjs/core';
import type { AddressInfo } from 'node:net';
import { API_PREFIX, type SalonReview, type SalonReviewsResponse } from '@salon-spot/contracts';
import { ApiExceptionFilter } from '../src/common/http/api-exception.filter.js';
import { RequestIdMiddleware } from '../src/common/http/request-id.middleware.js';
import { PrismaService } from '../src/common/database/prisma/prisma.service.js';
import { AccessTokenService } from '../src/modules/auth/application/access-token.service.js';
import { ProfessionalAccessService } from '../src/modules/professionals/application/professional-access.service.js';
import { ProfessionalGuard } from '../src/modules/professionals/presentation/professional.guard.js';
import { ReviewsService } from '../src/modules/reviews/application/reviews.service.js';
import { BookingReviewsController, PublicSalonReviewsController } from '../src/modules/reviews/presentation/reviews.controller.js';

const review: SalonReview = {
  id: 'review_1',
  salonId: 'salon_1',
  authorDisplayName: 'Mai Reviewer',
  rating: 5,
  body: 'A helpful review.',
  createdAt: '2026-09-08T08:00:00.000Z',
  verifiedRental: true
};
const listResponse: SalonReviewsResponse = {
  data: [review],
  meta: { page: 2, pageSize: 5, total: 6 },
  summary: { averageRating: 4.5, reviewCount: 6 }
};
const reviews = {
  create: jest.fn(async () => ({ review })),
  listPublished: jest.fn(async () => listResponse)
};

@Module({
  controllers: [BookingReviewsController, PublicSalonReviewsController],
  providers: [
    { provide: ReviewsService, useValue: reviews },
    ProfessionalGuard,
    { provide: ProfessionalAccessService, useValue: { assertActive: jest.fn().mockResolvedValue(undefined) } },
    { provide: AccessTokenService, useValue: { verify: () => ({ sub: 'user_1', email: 'pro@example.test' }) } },
    { provide: PrismaService, useValue: { user: { findUnique: () => ({ id: 'user_1', email: 'pro@example.test', displayName: 'Professional', status: 'ACTIVE' }) } } },
    { provide: APP_FILTER, useClass: ApiExceptionFilter }
  ]
})
class ReviewsHttpContractModule {}

describe('Salon reviews HTTP contract', () => {
  let app: Awaited<ReturnType<typeof NestFactory.create>>;
  let baseUrl: string;

  beforeAll(async () => {
    app = await NestFactory.create(ReviewsHttpContractModule, { logger: false });
    const requestIds = new RequestIdMiddleware();
    app.use(requestIds.use.bind(requestIds));
    app.setGlobalPrefix(API_PREFIX);
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}/${API_PREFIX}`;
  });

  afterAll(async () => app.close());
  beforeEach(() => jest.clearAllMocks());

  it('lists published Salon reviews publicly with validated pagination', async () => {
    const response = await fetch(`${baseUrl}/salons/salon_1/reviews?page=2&pageSize=5`);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(listResponse);
    expect(reviews.listPublished).toHaveBeenCalledWith('salon_1', { page: 2, pageSize: 5 });
  });

  it('requires authentication and an idempotency key before creating a review', async () => {
    const anonymous = await fetch(`${baseUrl}/bookings/booking_1/reviews`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': 'anonymous-review' }, body: JSON.stringify({ rating: 5 })
    });
    expect(anonymous.status).toBe(401);

    const missingKey = await fetch(`${baseUrl}/bookings/booking_1/reviews`, {
      method: 'POST', headers: { authorization: 'Bearer test-token', 'content-type': 'application/json' }, body: JSON.stringify({ rating: 5 })
    });
    expect(missingKey.status).toBe(400);
    expect(reviews.create).not.toHaveBeenCalled();

    const response = await fetch(`${baseUrl}/bookings/booking_1/reviews`, {
      method: 'POST',
      headers: { authorization: 'Bearer test-token', 'content-type': 'application/json', 'idempotency-key': 'create-review', 'x-request-id': 'review-request-1' },
      body: JSON.stringify({ rating: 5, body: 'A helpful review.' })
    });
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ review });
    expect(reviews.create).toHaveBeenCalledWith('user_1', 'booking_1', { rating: 5, body: 'A helpful review.' }, 'create-review', 'review-request-1');
  });

  it('rejects ratings outside 1 to 5 before invoking the review service', async () => {
    const response = await fetch(`${baseUrl}/bookings/booking_1/reviews`, {
      method: 'POST',
      headers: { authorization: 'Bearer test-token', 'content-type': 'application/json', 'idempotency-key': 'invalid-review' },
      body: JSON.stringify({ rating: 0 })
    });
    expect(response.status).toBe(400);
    expect(reviews.create).not.toHaveBeenCalled();
  });
});
