# Plan bổ sung Communication Reviews Trust và Admin Portal

## 1. Mục tiêu

Mở rộng Core MVP hiện tại thành một marketplace có khả năng giao tiếp, xây dựng niềm tin và vận hành có kiểm soát. Plan này bao gồm ba nhóm:

1. Communication và Notification.
2. Reviews và Trust.
3. Admin Portal đầy đủ theo phạm vi RFP.

Plan giữ nguyên các invariant hiện tại của Availability và Booking. Không đưa logic sửa slot, booking state hoặc payment state vào Communication, Notification hay Admin Portal.

## 2. Baseline và phạm vi hiện tại

### Đã có

- Auth, refresh session và BOLA.
- Professional profile cơ bản.
- Owner tạo Salon, Workspace, RentalOption và quản lý media.
- Fixed availability, hold, confirm, cancellation và completion.
- Booking snapshot theo timezone Salon.
- Outbox và worker cho booking lifecycle, media cleanup và notification log sink.
- Admin overview, user search/status, audit events và outbox events.
- Web responsive, EN/VI.

### Chưa hoàn chỉnh

- Chat chỉ có module khung, chưa có conversation/message.
- Notification mới dừng ở outbox/log sink; chưa có email provider, push hoặc notification inbox.
- Review, rating, report và moderation chưa có.
- Professional verification mới có persistence foundation; chưa có private upload, review queue và enforcement đầy đủ.
- Admin chưa có listing moderation, booking operations, support, review moderation, verification review, RBAC đầy đủ hoặc analytics lịch sử.

## 3. Nguyên tắc thiết kế

### 3.1 Module và seam

- `NotificationsModule`: nhận domain event sau commit, tạo notification và điều phối delivery.
- `CommunicationModule`: quản lý conversation, participant, message và attachment policy; không mutate Booking, Availability hoặc Payment.
- `ReviewsModule`: quản lý review gắn với Booking đã hoàn tất.
- `TrustModule`: quản lý verification status, credentials, reports và moderation case; không để frontend tự quyết định trust.
- `AdminModule`: lớp điều phối privileged action; không cho phép SQL console hoặc sửa trực tiếp state quan trọng.

### 3.2 Invariant dùng chung

- Mọi thay đổi nhạy cảm có `Idempotency-Key`, `requestId`, actor, reason và audit.
- External provider chỉ được gọi sau khi transaction nghiệp vụ đã commit.
- Outbox và delivery phải retry an toàn; không tạo notification/message/review trùng khi request được lặp.
- API dùng `/api/v1`, DTO validate, pagination chuẩn và error code ổn định.
- Private verification document và private message attachment không được public qua listing media.
- Admin permission được kiểm tra ở backend; ẩn nút ở UI không phải là authorization.
- English là locale mặc định; EN/VI chỉ thay đổi presentation, không thay đổi domain data.

## 4. Quyết định cần chốt trước khi build

Các mục sau là P0. Nếu chưa chốt, chỉ nên làm schema/contract có thể mở rộng, không khóa implementation vào giả định.

| ID | Quyết định | Đề xuất mặc định | Ảnh hưởng |
| --- | --- | --- | --- |
| D-01 | Thời điểm được nhắn tin | Sau khi booking `CONFIRMED`, kéo dài đến hết booking và thêm 7 ngày hỗ trợ | Spam, privacy, dispute |
| D-02 | Chat scope | Conversation gắn với `Booking`; không chat tự do ở V1 | Data model và moderation |
| D-03 | File trong chat | Không hỗ trợ attachment ở đợt đầu; chỉ text, URL không tự do | Malware, storage, privacy |
| D-04 | Notification channels | In-app bắt buộc; email provider tiếp theo; push sau khi chốt mobile strategy | Provider và worker |
| D-05 | Notification preference | User được tắt marketing, không được tắt transactional security/booking | Compliance và UX |
| D-06 | Review model | Two-sided: Professional review Workspace/Salon, Owner review Professional | Cần xác định Owner của Salon |
| D-07 | Review eligibility | Chỉ Booking `COMPLETED`, một review mỗi chiều, cho phép sửa trong 24 giờ | Chống review giả |
| D-08 | Review moderation | Review hiện ngay hoặc pending tùy policy; report chuyển Admin moderation case | Trust và support |
| D-09 | Verification enforcement | Chỉ Professional có `APPROVED` credential còn hạn mới được booking sau khi backfill | Có thể ảnh hưởng user cũ |
| D-10 | Admin roles | `SUPER_ADMIN`, `OPERATIONS`, `SUPPORT`, `COMPLIANCE`, `CONTENT_MODERATOR`; Finance chỉ bật cùng Payment | RBAC và audit |
| D-11 | Admin đọc chat | Mặc định không đọc nội dung; chỉ mở theo support/dispute permission và audit | Privacy/legal |
| D-12 | Analytics retention | Chốt thời gian lưu event, PII masking và timezone báo cáo | DB/storage/cost |

## 5. Phase A - Contract và domain foundation

### Mục tiêu

Đóng các decision P0, chuyển thành business rules, state transition và Acceptance Criteria trước khi thêm UI.

### Công việc

- Viết state machine cho Notification, Delivery, Conversation, Message, Review, Report, ModerationCase và SupportTicket.
- Chuẩn hóa domain event naming và payload version.
- Quy định actor, permission, retention, PII masking và audit cho từng command.
- Bổ sung contract types trong `packages/contracts`.
- Bổ sung migration additive; không đổi trực tiếp Booking/Availability state.
- Tạo fixture riêng cho Owner, Professional, Admin, completed booking, suspended account và reported content.

### Bằng chứng hoàn thành

- Mỗi command có Given/When/Then, authorization, idempotency, failure/retry và audit criteria.
- Không còn P0 TBD cho chat timing, review eligibility và Admin permission.
- Contract test compile được trước khi UI gọi endpoint.

## 6. Phase B - Communication và Notification foundation

### 6.1 Data model đề xuất

`Notification`:

- `id`, `recipientUserId`, `type`, `titleKey`, `bodyKey`, `payload`.
- `entityType`, `entityId`, `readAt`, `createdAt`, `expiresAt`.
- Unique key cho domain event + recipient + notification type để chống duplicate.

`NotificationPreference`:

- `userId`, channel flags, category flags, locale, updatedAt.
- Transactional booking/security notification không bị tắt bằng preference marketing.

`NotificationDelivery`:

- `notificationId`, `channel`, `status`, `attempts`, `availableAt`, `deliveredAt`, `lastError`.
- Unique `(notificationId, channel)`.

`OutboxEvent` tiếp tục là nguồn phát domain event; không dùng nó như inbox hiển thị cho user.

### 6.2 Domain events

Đợt đầu cần xử lý:

- `BOOKING_CONFIRMED`
- `BOOKING_CANCELLED`
- `BOOKING_COMPLETED`
- `BOOKING_RESCHEDULED` khi reschedule được duyệt
- `VERIFICATION_SUBMITTED`
- `VERIFICATION_APPROVED`
- `VERIFICATION_REJECTED`
- `REVIEW_SUBMITTED`
- `ACCOUNT_SUSPENDED`
- `LISTING_MODERATION_CHANGED`

Mỗi event phải có `eventId`, `eventVersion`, `occurredAt`, actor, recipient resolution và entity reference. Payload không chứa secret hoặc private document bytes.

### 6.3 API đề xuất

- `GET /api/v1/me/notifications?status=&page=&pageSize=`
- `GET /api/v1/me/notifications/unread-count`
- `PUT /api/v1/me/notifications/:notificationId/read`
- `PUT /api/v1/me/notifications/read-all`
- `GET /api/v1/me/notification-preferences`
- `PATCH /api/v1/me/notification-preferences`
- `POST /api/v1/admin/notifications/:notificationId/retry` nếu Admin có permission

Mọi write notification phải kiểm recipient ownership và replay idempotency.

### 6.4 Delivery adapters

Tạo interface deep ở `NotificationsModule`:

```text
NotificationDispatcher.dispatch(notificationId)
  -> resolve recipients
  -> apply preference policy
  -> create delivery attempts
  -> invoke channel adapter after commit
  -> persist delivered/failed state
```

Adapters:

- `InAppNotificationAdapter`: ghi `Notification` để user đọc trong app.
- `EmailNotificationAdapter`: provider thật, template version, locale, retry và provider message id.
- `PushNotificationAdapter`: để sau khi chốt mobile strategy; không giả lập push bằng log.

Failure policy:

- Provider timeout/5xx/429: retry exponential backoff có giới hạn.
- Permanent 4xx: mark failed, không retry vô hạn.
- Booking state không rollback khi delivery fail.
- Admin xem được delivery status, attempts và safe error.

### 6.5 Web

- Notification bell/unread count.
- Notification inbox có filter đọc/chưa đọc.
- Deep link đến Booking, verification, review hoặc support item.
- Preference screen, phân biệt transactional và marketing.
- Hiển thị trạng thái lỗi delivery thân thiện; không lộ provider error.

### 6.6 Acceptance Criteria

- Booking confirm tạo đúng một notification cho Professional và Owner sau commit.
- Replay cùng domain event không tạo bản ghi duplicate.
- Mark read chỉ ảnh hưởng notification của user hiện tại.
- User bị suspend không nhận notification không cần thiết; policy booking/support được xác định riêng.
- Email provider lỗi không làm transaction booking fail.
- Retry crash-safe sau khi worker restart.
- EN/VI dùng template tương ứng; payload không chứa nội dung dịch cứng từ client.

## 7. Phase C - Communication messaging

### 7.1 Data model đề xuất

`Conversation`:

- `id`, `bookingId?`, `workspaceId?`, `status`, `createdAt`, `lastMessageAt`.
- V1 ưu tiên conversation gắn với Booking để có authorization rõ.

`ConversationParticipant`:

- `conversationId`, `userId`, `role`, `joinedAt`, `leftAt`, `lastReadAt`.
- Unique `(conversationId, userId)`.

`Message`:

- `id`, `conversationId`, `senderUserId`, `body`, `status`, `createdAt`, `editedAt`, `deletedAt`.
- Không cho phép sender tự thay đổi participant hoặc booking state.

`MessageReport` hoặc `CommunicationModerationCase`:

- `messageId`, reporter, reason code, status, assigned admin, resolution, audit.

Attachment chỉ thêm ở phase riêng sau khi có storage private, MIME sniffing, size limit, malware scanning, signed download và retention policy.

### 7.2 API đề xuất

- `GET /api/v1/me/conversations`
- `POST /api/v1/conversations` với booking context
- `GET /api/v1/conversations/:conversationId/messages?page=&pageSize=`
- `POST /api/v1/conversations/:conversationId/messages`
- `PUT /api/v1/conversations/:conversationId/read`
- `POST /api/v1/messages/:messageId/report`

V1 dùng polling hoặc refresh theo trang; realtime WebSocket chỉ thêm sau khi xác định nhu cầu và vận hành connection rõ ràng.

### 7.3 Rules

- Chỉ participant mới đọc/gửi message.
- Conversation chỉ tạo khi thỏa timing policy đã chốt.
- Account suspended không được mở conversation mới; xử lý conversation của booking tương lai theo policy.
- Message không được chứa password, token, private document hoặc payment secret.
- Xóa message là soft delete để giữ audit/dispute evidence.
- Không cho chat command thay đổi Booking, Availability hoặc Payment.

### 7.4 Acceptance Criteria

- Cross-user và cross-booking access trả `403` hoặc `404` an toàn.
- Gửi message lặp cùng idempotency key không tạo duplicate.
- Message order ổn định theo server `createdAt` và `id`.
- Report tạo moderation case và notification cho đúng Admin queue.
- Suspended user không thể bypass bằng access token cũ.

## 8. Phase D - Reviews và Trust

### 8.1 Professional verification

Hoàn thiện foundation hiện có:

- Professional tạo verification case.
- Upload/finalize private license, insurance và identity evidence.
- Validate loại file, kích thước, checksum, expiry và ownership.
- Submit/resubmit case.
- Admin Compliance xem queue, approve/reject/revoke với reason.
- Reminder trước expiry.
- Booking eligibility kiểm tra `APPROVED` và credential hợp lệ đến hết slot.
- Có migration/backfill cho profile cũ trước khi bật enforcement.

Không public URL của verification document. Download cần signed URL ngắn hạn và permission `VERIFY_PROFESSIONAL`.

### 8.2 Review data model

`Review`:

- `id`, `bookingId`, `authorUserId`, `subjectType`, `subjectId`.
- `rating` 1-5, `body`, `status`, `createdAt`, `editedAt`, `publishedAt`, `hiddenAt`.
- Unique `(bookingId, authorUserId, subjectType, subjectId)`.

`ReviewReport`:

- `reviewId`, `reporterUserId`, `reasonCode`, `details`, `status`, `resolvedBy`, `resolvedAt`.

`TrustSummary` nếu cần performance:

- aggregate score, review count, verified flag, lastCalculatedAt.
- Tính lại từ review được publish; không tin số điểm do client gửi.

### 8.3 Review rules đề xuất

- Chỉ review khi Booking `COMPLETED`.
- Một Professional review Workspace/Salon một lần; Owner review Professional một lần.
- Chỉ actor liên quan booking mới được review.
- Cho sửa trong 24 giờ; sau đó chỉ Admin xử lý moderation.
- Cancelled booking không được review.
- Review bị report vẫn giữ evidence nhưng có thể ẩn khỏi public.
- Không cho Admin sửa nội dung review trực tiếp; Admin đổi moderation status và ghi reason.

### 8.4 API đề xuất

- `GET /api/v1/workspaces/:workspaceId/reviews?page=&pageSize=`
- `GET /api/v1/professionals/:professionalUserId/reviews?page=&pageSize=`
- `POST /api/v1/bookings/:bookingId/reviews`
- `PATCH /api/v1/reviews/:reviewId`
- `POST /api/v1/reviews/:reviewId/report`
- `GET /api/v1/me/reviews`

### 8.5 Web

- Rating/review form chỉ hiện sau completion.
- Review summary trên Workspace detail.
- Review history của Professional.
- Report action có reason bắt buộc.
- Trust badges chỉ dựa trên server state: verified, credential expiry warning, completed bookings.
- Không hiển thị “verified” nếu chỉ có profile hoặc email xác nhận.

### 8.6 Acceptance Criteria

- Không review được booking chưa completed, booking của user khác hoặc booking cancelled.
- Database chặn duplicate review race.
- Rating ngoài 1-5 và body vượt giới hạn bị từ chối.
- Review report không làm mất review ngay nếu chưa có moderation decision.
- Hidden/removed review không ảnh hưởng public aggregate.
- Verification document không truy cập được bằng listing media URL.
- Credential hết hạn xử lý đúng booking mới và booking đã confirmed theo policy.

## 9. Phase E - Admin Portal đầy đủ

### 9.1 RBAC

Giữ `AdminAccess` làm quyền vào portal, thêm permission nhỏ hơn:

| Role/permission | Quyền chính |
| --- | --- |
| `SUPER_ADMIN` | Quản lý Admin access, system configuration, break-glass theo quy trình riêng |
| `OPERATIONS` | Overview, booking/listing operations, worker/outbox recovery |
| `SUPPORT` | User lookup, support ticket, conversation metadata, booking assistance |
| `COMPLIANCE` | Verification queue, private document review |
| `CONTENT_MODERATOR` | Listing/review/message report moderation |
| `FINANCE` | Chỉ bật khi Payment module có ledger và policy refund/payout |

Mọi privileged action phải có permission backend, reason, before/after, requestId, actor và audit event.

### 9.2 Admin modules và màn hình

#### Dashboard

- Active/suspended users
- Published/draft/hidden listings
- Booking confirmed/cancelled/completed
- Review/report queue
- Verification queue và expiry risk
- Notification delivery failure
- Worker/outbox health
- KPI theo khoảng thời gian

#### User management

- Search/filter/detail user
- Profile và role/access summary
- Suspend/reactivate
- Xem verification status
- Xem booking/support/review summary với PII tối thiểu
- Session revoke và security action theo permission

#### Listing moderation

- Search/filter theo status, area, report count
- Xem listing/media/owner/audit
- Hide/unhide/archive listing
- Ghi reason và notification cho Owner
- Không trực tiếp sửa availability/booking state

#### Booking operations

- Search theo booking id, user, Workspace, status, date
- Xem timeline state/audit/notification
- Xem impact của hold/booking conflict
- Hỗ trợ cancellation hoặc escalation theo policy
- Không direct-edit state; command phải đi qua domain service

#### Verification review

- Queue theo `SUBMITTED`/`UNDER_REVIEW`/expiry
- Xem private document bằng signed URL và permission riêng
- Approve/reject/revoke với reason code
- Resubmission history
- Credential expiry reminder

#### Trust and moderation

- Review reports
- Message reports
- Listing reports
- Assign moderator
- Hide/restore/remove theo policy
- Resolution notes và audit trail

#### Support

- Support ticket tạo từ user hoặc Admin
- Link ticket với User, Booking, Conversation, Review hoặc VerificationCase
- Status `OPEN`, `IN_PROGRESS`, `WAITING_USER`, `RESOLVED`, `CLOSED`
- Internal note không gửi cho user
- SLA/priority/assignee

#### Notification operations

- Delivery status, attempts, provider safe error
- Retry dead-letter event có permission
- Xem correlation tới domain event
- Không cho sửa payload tùy ý để giả mạo notification

#### Analytics và content

- Booking funnel: search → detail → hold → confirm → complete
- Cancellation/no-show/review/report rate
- Workspace utilization theo slot
- Notification delivery rate
- Verification turnaround time
- Content/configuration management có version và audit

#### System configuration

- Notification template version
- Hold TTL và policy config nếu được phép thay đổi
- Review/report reason catalog
- Feature flags
- Provider status/config reference, không lưu secret trong UI

### 9.3 API đề xuất

- `GET /api/v1/admin/dashboard`
- `GET /api/v1/admin/users` và `GET /api/v1/admin/users/:userId`
- `GET /api/v1/admin/listings`
- `PUT /api/v1/admin/listings/:listingId/moderation`
- `GET /api/v1/admin/bookings`
- `GET /api/v1/admin/bookings/:bookingId/timeline`
- `GET /api/v1/admin/verification-cases`
- `POST /api/v1/admin/verification-cases/:caseId/decision`
- `GET /api/v1/admin/reports`
- `POST /api/v1/admin/reports/:reportId/decision`
- `GET /api/v1/admin/support-tickets`
- `POST /api/v1/admin/support-tickets`
- `PATCH /api/v1/admin/support-tickets/:ticketId`
- `GET /api/v1/admin/notification-deliveries`
- `POST /api/v1/admin/notification-deliveries/:id/retry`
- `GET /api/v1/admin/analytics/summary`
- `GET /api/v1/admin/config`
- `PATCH /api/v1/admin/config/:key`

Payment reporting/refund/payout chỉ mở sau khi PaymentsModule có ledger, provider webhook và reconciliation; không tạo màn hình tài chính giả dựa trên Booking `priceCents`.

### 9.4 Acceptance Criteria

- Admin không có permission bị `403` dù biết endpoint.
- Cross-tenant/cross-entity lookup không làm lộ private data.
- Moderation action idempotent, có reason và audit before/after.
- Admin không thể tự cấp quyền cao hơn qua UI.
- Listing hide không phá booking snapshot và booking tương lai nếu policy chưa cho phép hủy.
- Retry notification không tạo duplicate delivery.
- Support internal note không xuất hiện trong message user.
- Dashboard metrics có timezone, thời điểm snapshot và query scope rõ ràng.

## 10. Thứ tự delivery đề xuất

### Sprint 0 - Scope freeze

- Chốt D-01 đến D-12.
- Viết state machine và Acceptance Criteria.
- Chốt role/permission matrix.

### Sprint 1 - Notification foundation

- Domain event catalog.
- `Notification`, preference, delivery schema.
- In-app inbox/unread/read.
- Outbox dispatcher và retry.
- Regression cho confirm/cancel/complete.

### Sprint 2 - Real email và communication

- Email adapter/provider sandbox.
- Template EN/VI.
- Conversation/message text-only.
- Report message.
- Web inbox/chat.

### Sprint 3 - Verification và reviews

- Private document upload/review.
- Verification queue.
- Review eligibility, review CRUD và report.
- Trust summary/badge.

### Sprint 4 - Admin Portal core

- RBAC/permissions.
- Dashboard, user, listing, booking operations.
- Verification/moderation queues.
- Support tickets.

### Sprint 5 - Operations và analytics

- Notification delivery operations.
- Analytics summary.
- Content/configuration.
- Audit search/export policy.
- Browser UAT, recovery và permission race tests.

## 11. File/module impact

### Backend

- Thêm `apps/api/src/modules/notifications/`.
- Thêm `apps/api/src/modules/communication/` hoặc đổi `chat/` placeholder thành module triển khai thật.
- Thêm `apps/api/src/modules/reviews/`.
- Thêm `apps/api/src/modules/trust/` hoặc mở rộng `professionals/` cho verification workflow.
- Mở rộng `apps/api/src/modules/admin/` theo từng capability, không tạo một service admin khổng lồ.
- Mở rộng `apps/api/src/common/worker/` cho delivery/retry, giữ lease và heartbeat.

### Database và contracts

- Additive Prisma migrations cho notification, delivery, conversation, participant, message, review, report, moderation case và support ticket.
- Cập nhật `packages/contracts/src/index.ts` theo DTO/interface versioned.
- Không expose Prisma model trực tiếp qua contracts.

### Web

- `apps/web/src/features/notifications/`.
- `apps/web/src/features/communication/`.
- `apps/web/src/features/reviews/`.
- `apps/web/src/features/trust/`.
- Mở rộng `apps/web/src/features/admin/` thành các page/section theo permission.
- Dùng route URL làm nguồn trạng thái; không giữ unread, moderation hoặc review state chỉ trong React memory.

### Tests

- Unit test cho policy/state transition.
- HTTP contract test cho từng permission.
- MySQL test cho duplicate review/message/notification và concurrent moderation.
- Worker test cho retry, lease expiry, crash/restart và dead-letter.
- Browser UAT cho EN/VI, mobile layout, deep link, unread/read, review form và Admin permission denial.

## 12. Definition of Done

Một phase chỉ được xem là hoàn thành khi:

- Schema migration mới chạy được trên MySQL sạch.
- API contract, frontend và database cùng một state model.
- Happy path, validation, BOLA/RBAC, idempotency, retry và audit đều có test.
- Provider failure không rollback domain transaction.
- Private data không public qua endpoint/media URL khác.
- Browser UAT chạy được trên refresh/direct URL/mobile viewport.
- Admin action có evidence actor, permission, reason, requestId và before/after.
- Có runbook cho provider outage, worker restart, dead-letter và moderation escalation.

## 13. Không đưa vào cùng đợt nếu chưa có quyết định nền

- Payment/refund/payout hoặc Finance Admin nếu chưa có ledger và commercial policy.
- Realtime WebSocket nếu chưa có yêu cầu latency/scale rõ.
- Chat attachment nếu chưa có private storage và malware scanning.
- AI moderation hoặc recommendation.
- Native iOS/Android nếu chưa chốt platform strategy.
- Direct Admin SQL/recovery mutation đối với Booking/Availability.

## 14. Rủi ro chính

| Rủi ro | Biện pháp |
| --- | --- |
| Notification duplicate hoặc mất sau provider failure | Event id, delivery uniqueness, outbox lease/retry và in-app source of truth |
| Chat trở thành kênh bypass marketplace | Conversation policy, masking/retention decision và moderation |
| Review giả hoặc thao túng rating | Completed booking linkage, one-review constraint, report/moderation và audit |
| Admin có quyền quá rộng | Permission matrix, backend guard, least privilege và two-person approval cho action nhạy cảm |
| Verification làm khóa user cũ | Backfill, staged enforcement, confirm-time check và rollback plan |
| Admin listing action phá booking lịch sử | Soft moderation state, immutable booking snapshot và domain command |
| Provider/config lộ secret | Secret manager/env runtime; Admin UI chỉ hiển thị reference/status |
| Scope phình thành full product | Mỗi phase có contract, owner decision, acceptance criteria và explicit non-goals |

## 15. Kết quả mong đợi

Sau các phase này, hệ thống sẽ có:

- Notification có thể đọc trong app, gửi qua provider và theo dõi delivery.
- Communication có authorization, audit và moderation.
- Review chỉ đến từ booking hợp lệ, có trust signal và report workflow.
- Professional verification có evidence riêng tư và Admin review.
- Admin Portal đủ để vận hành user, listing, booking, verification, moderation, support, notification và analytics.
- Các phần Payment/Finance vẫn được giữ sau seam rõ ràng, không tạo số liệu tài chính giả trước khi payment domain được phê duyệt.
