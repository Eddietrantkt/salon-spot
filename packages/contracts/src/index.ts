/** Shared transport contracts only. ORM models never cross this boundary. */
export const API_PREFIX = 'api/v1';

export const API_ERROR_CODES = [
  'AUTHENTICATION_FAILED',
  'AVAILABILITY_CONFLICT',
  'ACTIVE_CHECKOUT_IMPACT',
  'BOOKED_SLOT_IMMUTABLE',
  'HOLD_EXPIRED',
  'CANCELLATION_WINDOW_CLOSED',
  'REVIEW_NOT_ELIGIBLE',
  'REVIEW_ALREADY_EXISTS',
  'PAST_SLOT_IMMUTABLE',
  'FORBIDDEN',
  'IDEMPOTENCY_CONFLICT',
  'MEDIA_LIMIT_EXCEEDED',
  'MEDIA_NOT_READY',
  'NOT_FOUND',
  'PUBLISH_CHECKLIST_FAILED',
  'VALIDATION_ERROR',
  'CONFLICT',
  'INTERNAL_ERROR'
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export interface ApiError {
  code: ApiErrorCode;
  message: string;
  requestId: string;
}

export interface HealthResponse {
  status: 'ok';
  service: 'salon-spot-api';
  timestamp: string;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  displayName: string;
}

export interface AccountCapabilities {
  professionalStatus: ProfessionalProfileStatus | null;
  owner: boolean;
  admin: boolean;
}

export interface AuthenticationResponse {
  user: AuthenticatedUser;
  capabilities: AccountCapabilities;
  accessToken: string;
  accessTokenExpiresAt: string;
}

/** A registration-time routing choice, never an authorization role. */
export const REGISTRATION_INTENTS = ['PROFESSIONAL', 'OWNER'] as const;
export type RegistrationIntent = (typeof REGISTRATION_INTENTS)[number];

export type ProfessionalProfileStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED';
export type ProfessionalVerificationStatus = 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'REVOKED';

export interface ProfessionalProfile {
  userId: string;
  status: ProfessionalProfileStatus;
  verificationStatus: ProfessionalVerificationStatus;
  phone: string | null;
  city: string | null;
  bio: string | null;
  specialties: string[];
}

export interface UpdateProfessionalProfileInput {
  phone?: string;
  city?: string;
  bio?: string;
  specialties?: string[];
}

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PageMeta;
}

export interface WorkspaceSearchItem {
  workspaceId: string;
  workspaceName: string;
  salonName: string;
  area: string;
  timezone: string;
  startingPriceCents: number | null;
  availableSlotCount: number;
  media: PublicMedia[];
}

export type WorkspaceSearchResponse = PaginatedResponse<WorkspaceSearchItem>;

export interface PublicWorkspaceSlot {
  id: string;
  startsAt: string;
  endsAt: string;
  rentalOptionLabel: string;
  priceCents: number;
}

/** Public detail is an availability snapshot; the server remains authoritative at hold time. */
export interface WorkspaceDetailResponse {
  workspaceId: string;
  salonId: string;
  workspaceName: string;
  salonName: string;
  area: string;
  timezone: string;
  media: PublicMedia[];
  slots: PublicWorkspaceSlot[];
}

export interface SlotHold {
  id: string;
  slotId: string;
  workspaceId: string;
  workspaceName: string;
  salonName: string;
  timezone: string;
  rentalOptionLabel: string;
  priceCents: number;
  startsAt: string;
  endsAt: string;
  expiresAt: string;
}

export interface CreateSlotHoldResponse {
  hold: SlotHold;
}

export interface MyHoldsResponse {
  holds: SlotHold[];
}

export interface BookingSummary {
  id: string;
  status: 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
  workspaceName: string;
  rentalOptionLabel: string;
  priceCents: number;
  startsAt: string;
  endsAt: string;
  /** IANA timezone snapshot from the Salon at confirmation time. */
  salonTimezone: string;
  /** Salon-local calendar date snapshot, independent of the viewer's locale. */
  localDate: string;
  cancelledAt: string | null;
  completedAt: string | null;
  /** Present after this completed rental has been reviewed. */
  reviewId: string | null;
}

export interface ConfirmHoldResponse {
  booking: BookingSummary;
}

export interface MyBookingsResponse {
  bookings: BookingSummary[];
}

export interface BookingDetailResponse {
  booking: BookingSummary;
  /** Only the Professional who created the booking may cancel it. */
  viewerCanCancel: boolean;
  /** True only while this viewer may submit the first review for this completed rental. */
  viewerCanReview: boolean;
}

export interface CancelBookingResponse {
  booking: BookingSummary;
}

export interface SalonReview {
  id: string;
  salonId: string;
  authorDisplayName: string;
  rating: number;
  body: string | null;
  createdAt: string;
  verifiedRental: true;
}

export interface CreateSalonReviewInput {
  rating: number;
  body?: string;
}

export interface CreateSalonReviewResponse {
  review: SalonReview;
}

export interface SalonReviewSummary {
  averageRating: number | null;
  reviewCount: number;
}

export interface SalonReviewsResponse extends PaginatedResponse<SalonReview> {
  summary: SalonReviewSummary;
}

export type NotificationType = 'BOOKING_CONFIRMED' | 'BOOKING_CANCELLED' | 'BOOKING_COMPLETED';
export type NotificationReadStatus = 'read' | 'unread';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  titleKey: string;
  bodyKey: string;
  payload: Record<string, string>;
  entityType: string;
  entityId: string;
  readAt: string | null;
  createdAt: string;
  expiresAt: string | null;
}

export type NotificationsResponse = PaginatedResponse<NotificationItem>;

export interface NotificationUnreadCountResponse {
  unreadCount: number;
}

export interface MarkAllNotificationsReadResponse extends NotificationUnreadCountResponse {
  updatedCount: number;
}

export interface NotificationPreferences {
  locale: 'EN' | 'VI';
  emailEnabled: boolean;
  marketingEnabled: boolean;
  /** Transactional in-app delivery is mandatory and cannot be disabled. */
  transactionalInAppEnabled: true;
}

export interface UpdateNotificationPreferencesInput {
  locale?: 'EN' | 'VI';
  emailEnabled?: boolean;
  marketingEnabled?: boolean;
}

export type AdminUserStatus = 'ACTIVE' | 'SUSPENDED';

export interface AdminOverviewResponse {
  generatedAt: string;
  users: { active: number; suspended: number };
  salons: number;
  workspaces: { draft: number; published: number; archived: number };
  bookings: { confirmed: number; cancelled: number; completed: number };
  slots: { open: number; held: number; booked: number; blocked: number };
  outbox: { pending: number; processing: number; failed: number };
  workers: AdminWorkerHealth[];
}

export interface AdminWorkerHealth {
  name: 'hold-expiry' | 'booking-lifecycle' | 'notification-delivery' | 'media-cleanup';
  status: 'HEALTHY' | 'STALE' | 'FAILED' | 'UNKNOWN';
  lastSucceededAt: string | null;
  lastFailedAt: string | null;
  lastError: string | null;
}

export interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  status: AdminUserStatus;
  createdAt: string;
  isAdmin: boolean;
  ownedSalonCount: number;
  bookingCount: number;
}

export type AdminUsersResponse = PaginatedResponse<AdminUser>;

export interface UpdateAdminUserStatusResponse {
  user: AdminUser;
}

export interface AdminAuditEvent {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorEmail: string | null;
  requestId: string | null;
  createdAt: string;
}

export interface AdminAuditEventsResponse {
  events: AdminAuditEvent[];
}

export interface AdminOutboxEvent {
  id: string;
  topic: string;
  status: 'PENDING' | 'PROCESSING' | 'DELIVERED' | 'FAILED';
  attempts: number;
  availableAt: string;
  createdAt: string;
}

export interface AdminOutboxEventsResponse {
  events: AdminOutboxEvent[];
}

export type MediaStatus = 'PENDING_UPLOAD' | 'PROCESSING' | 'READY' | 'REJECTED' | 'DELETE_PENDING' | 'DELETED';

export interface PublicMedia {
  id: string;
  url: string;
  width: number;
  height: number;
  sortOrder: number;
  isCover: boolean;
}

export interface OwnerMedia {
  id: string;
  status: MediaStatus;
  contentType: string;
  byteSize: number | null;
  width: number | null;
  height: number | null;
  sortOrder: number;
  isCover: boolean;
  url: string | null;
  failureReason: string | null;
}

/** Values are expressed in VND despite the legacy `priceCents` field name. */
export interface OwnerWorkspace {
  id: string;
  name: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  rentalOptions: Array<{
    id: string;
    label: string;
    priceCents: number;
  }>;
  media: OwnerMedia[];
}

export interface OwnerSalon {
  id: string;
  name: string;
  area: string;
  timezone: string;
  media: OwnerMedia[];
  workspaces: OwnerWorkspace[];
}

export interface CreateWorkspaceInput {
  name: string;
  rentalLabel: string;
  priceCents: number;
}

export interface CreateSalonWithWorkspaceInput {
  name: string;
  area: string;
  timezone: string;
  workspace: CreateWorkspaceInput;
}

export interface CreateWorkspaceResponse {
  workspace: OwnerWorkspace;
}

export interface CreateSalonWithWorkspaceResponse {
  salon: OwnerSalon;
}

export interface CreateMediaUploadIntentInput {
  contentType: 'image/jpeg' | 'image/png' | 'image/webp';
}

export interface MediaUploadIntentResponse {
  media: OwnerMedia;
  upload: {
    method: 'PUT';
    url: string;
    headers: { 'Content-Type': string };
    expiresAt: string;
    maxBytes: number;
  };
}

export interface ReorderMediaInput {
  mediaIds: string[];
}

export interface SetMediaCoverInput {
  mediaId: string | null;
}

export interface PublishChecklistItem {
  code: 'SALON_DETAILS' | 'WORKSPACE_NAME' | 'RENTAL_OPTION' | 'MEDIA_PROCESSING';
  passed: boolean;
  message: string;
}

export interface WorkspacePublishChecklistResponse {
  eligible: boolean;
  checks: PublishChecklistItem[];
}

/** The MVP exposes only these owner-selectable rental windows. */
export const FIXED_SLOT_PERIODS = ['09:00-11:00', '11:00-13:00', '13:00-15:00', '15:00-17:00'] as const;

export type FixedSlotPeriod = (typeof FIXED_SLOT_PERIODS)[number];

export interface OpenWorkspaceSlotsInput {
  localDate: string;
  periods: FixedSlotPeriod[];
}

export interface OwnerAvailabilitySlot {
  id: string;
  period: FixedSlotPeriod;
  startsAt: string;
  endsAt: string;
  status: 'OPEN' | 'HELD' | 'BOOKED' | 'BLOCKED';
}

export interface OpenWorkspaceSlotsResponse {
  localDate: string;
  slots: OwnerAvailabilitySlot[];
}

export type BlockWorkspaceSlotsInput = OpenWorkspaceSlotsInput;

export type BlockWorkspaceSlotsResponse = OpenWorkspaceSlotsResponse;

export type OwnerWorkspaceScheduleResponse = OpenWorkspaceSlotsResponse;
