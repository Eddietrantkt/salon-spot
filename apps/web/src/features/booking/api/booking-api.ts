import type {
  BookingDetailResponse,
  CancelBookingResponse,
  ConfirmHoldResponse,
  CreateSlotHoldResponse,
  MyBookingsResponse,
  MyHoldsResponse,
  WorkspaceDetailResponse
} from '@salon-spot/contracts';
import { authenticatedGetJson, getJson, postJson } from '../../../shared/api/http';

export function getWorkspaceDetail(workspaceId: string, date: string): Promise<WorkspaceDetailResponse> {
  return getJson<WorkspaceDetailResponse>(`/workspaces/${encodeURIComponent(workspaceId)}?${new URLSearchParams({ date })}`);
}

export function getMyHolds(accessToken: string): Promise<MyHoldsResponse> { return authenticatedGetJson<MyHoldsResponse>('/me/holds', accessToken); }
export function getMyBookings(accessToken: string): Promise<MyBookingsResponse> { return authenticatedGetJson<MyBookingsResponse>('/me/bookings', accessToken); }
export function getBooking(accessToken: string, bookingId: string): Promise<BookingDetailResponse> { return authenticatedGetJson<BookingDetailResponse>(`/me/bookings/${encodeURIComponent(bookingId)}`, accessToken); }
export function createHold(accessToken: string, slotId: string, key: string): Promise<CreateSlotHoldResponse> { return postJson<CreateSlotHoldResponse>(`/availability/slots/${encodeURIComponent(slotId)}/holds`, {}, accessToken, key); }
export function confirmHold(accessToken: string, holdId: string, key: string): Promise<ConfirmHoldResponse> { return postJson<ConfirmHoldResponse>(`/holds/${encodeURIComponent(holdId)}/confirm`, {}, accessToken, key); }
export function cancelBooking(accessToken: string, bookingId: string, key: string): Promise<CancelBookingResponse> { return postJson<CancelBookingResponse>(`/bookings/${encodeURIComponent(bookingId)}/cancel`, {}, accessToken, key); }
