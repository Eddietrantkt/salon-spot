import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { BookingStatus, Prisma, ReviewStatus } from '@prisma/client';
import type { CreateSalonReviewResponse, SalonReview, SalonReviewsResponse } from '@salon-spot/contracts';
import { PrismaService } from '../../../common/database/prisma/prisma.service.js';
import { executeIdempotently } from '../../../common/http/idempotency.js';
import { ProfessionalAccessService } from '../../professionals/application/professional-access.service.js';
import type { CreateSalonReviewDto } from '../presentation/dto/create-salon-review.dto.js';
import type { SalonReviewQueryDto } from '../presentation/dto/salon-review-query.dto.js';

const reviewSelection = {
  id: true,
  salonId: true,
  rating: true,
  body: true,
  createdAt: true,
  author: { select: { displayName: true } }
} satisfies Prisma.ReviewSelect;

type ReviewRecord = Prisma.ReviewGetPayload<{ select: typeof reviewSelection }>;

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService, private readonly professionals: ProfessionalAccessService) {}

  async create(
    actorUserId: string,
    bookingId: string,
    input: CreateSalonReviewDto,
    idempotencyKey: string,
    requestId?: string
  ): Promise<CreateSalonReviewResponse> {
    await this.professionals.assertActive(actorUserId);
    const request = { rating: input.rating, body: normalizeBody(input.body) };
    return executeIdempotently(this.prisma, actorUserId, `booking-review-create:${bookingId}`, idempotencyKey, request, async (tx) => {
      await this.professionals.assertActive(actorUserId, tx);
      const candidate = await tx.booking.findFirst({ where: { id: bookingId, professionalUserId: actorUserId }, select: { id: true } });
      if (!candidate) throw new NotFoundException('Completed booking was not found.');

      await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT id FROM Booking WHERE id = ${bookingId} FOR UPDATE`);
      const booking = await tx.booking.findFirst({
        where: { id: bookingId, professionalUserId: actorUserId },
        select: {
          id: true,
          status: true,
          review: { select: { id: true } },
          slot: { select: { workspace: { select: { salonId: true } } } }
        }
      });
      if (!booking) throw new NotFoundException('Completed booking was not found.');
      if (booking.status !== BookingStatus.COMPLETED) {
        throw new ConflictException({ code: 'REVIEW_NOT_ELIGIBLE', message: 'Only a completed booking can be reviewed.' });
      }
      if (booking.review) {
        throw new ConflictException({ code: 'REVIEW_ALREADY_EXISTS', message: 'This booking has already been reviewed.' });
      }

      let review: ReviewRecord;
      try {
        review = await tx.review.create({
          data: {
            bookingId,
            authorUserId: actorUserId,
            salonId: booking.slot.workspace.salonId,
            rating: input.rating,
            body: request.body
          },
          select: reviewSelection
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw alreadyReviewed();
        throw error;
      }
      await tx.auditEvent.create({
        data: {
          actorUserId,
          entityType: 'Review',
          entityId: review.id,
          action: 'REVIEW_SUBMITTED',
          requestId,
          after: { bookingId, salonId: review.salonId, rating: review.rating }
        }
      });
      return { review: toSalonReview(review) };
    });
  }

  async listPublished(salonId: string, query: SalonReviewQueryDto): Promise<SalonReviewsResponse> {
    const salon = await this.prisma.salon.findUnique({ where: { id: salonId }, select: { id: true } });
    if (!salon) throw new NotFoundException('Salon was not found.');

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const where: Prisma.ReviewWhereInput = { salonId, status: ReviewStatus.PUBLISHED };
    const [reviews, total, aggregate] = await this.prisma.$transaction([
      this.prisma.review.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: reviewSelection
      }),
      this.prisma.review.count({ where }),
      this.prisma.review.aggregate({ where, _avg: { rating: true } })
    ]);
    return {
      data: reviews.map(toSalonReview),
      meta: { page, pageSize, total },
      summary: { averageRating: aggregate._avg.rating, reviewCount: total }
    };
  }
}

function alreadyReviewed(): ConflictException {
  return new ConflictException({ code: 'REVIEW_ALREADY_EXISTS', message: 'This booking has already been reviewed.' });
}

function normalizeBody(body: string | undefined): string | null {
  const normalized = body?.trim();
  return normalized ? normalized : null;
}

function toSalonReview(review: ReviewRecord): SalonReview {
  return {
    id: review.id,
    salonId: review.salonId,
    authorDisplayName: review.author.displayName,
    rating: review.rating,
    body: review.body,
    createdAt: review.createdAt.toISOString(),
    verifiedRental: true
  };
}
