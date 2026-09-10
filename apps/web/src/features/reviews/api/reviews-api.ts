import type { CreateSalonReviewInput, CreateSalonReviewResponse, SalonReviewsResponse } from '@salon-spot/contracts';
import { getJson, postJson } from '../../../shared/api/http';

export function createSalonReview(
  accessToken: string,
  bookingId: string,
  input: CreateSalonReviewInput,
  idempotencyKey: string
): Promise<CreateSalonReviewResponse> {
  return postJson<CreateSalonReviewResponse>(`/bookings/${encodeURIComponent(bookingId)}/reviews`, input, accessToken, idempotencyKey);
}

export function getSalonReviews(salonId: string, page = 1, pageSize = 5): Promise<SalonReviewsResponse> {
  return getJson<SalonReviewsResponse>(`/salons/${encodeURIComponent(salonId)}/reviews?${new URLSearchParams({ page: String(page), pageSize: String(pageSize) })}`);
}
