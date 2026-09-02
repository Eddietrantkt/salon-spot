# Kế hoạch xây dựng sơ bộ - Core MVP 2 tuần

## Mục tiêu

Hoàn thành một vertical slice staging/UAT: Owner publish Workspace có ảnh và slot cố định; Professional search, hold rồi confirm một slot; huỷ/completion/audit/email hoạt động đúng rule. Không bao gồm AI, payment, Manager, chat hoặc reschedule.

## Thứ tự triển khai

1. **D1 - nền tảng (đã khởi tạo):** monorepo, NestJS, React/Vite mobile-first web, MySQL 8.4, Prisma schema, hợp đồng API, CI/lint/test cơ bản.
2. **D2 - identity và Professional access (đã xây dựng):** User/password hash, JWT access token, rotating refresh session, `SalonMembership` OWNER authorizer, `AdminAccess` và `ProfessionalProfile` độc lập. Hold/confirm/booking chỉ nhận profile Professional `ACTIVE`; Owner/Admin không kế thừa quyền này. DB đã có foundation additive cho verification case, credential, private document, quyền Admin review và password-reset token ở cấp User; chưa bật onboarding/enforcement.
3. **D3-D4 - supply/media (đã xây dựng):** Salon, Workspace, RentalOption, signed upload intent/finalize, ảnh `READY`, cover/reorder/delete, stale-intent/processing recovery, outbox/worker và publish checklist. Bộ migration hiện có đã áp thành công trên MySQL 8.4 local; race riêng của giới hạn media và cleanup retry vẫn cần bổ sung.
4. **D5 - inventory (đã xây dựng):** Owner đọc, mở/reopen và block theo batch các slot cố định 09-11/11-13/13-15/15-17 cho ngày tương lai của Workspace `PUBLISHED`. Mọi mutation idempotent, khóa `WorkspaceCalendarLock` bằng `FOR UPDATE`, từ chối toàn batch nếu chạm `HELD`/`BOOKED`, ghi audit; Discovery chỉ đọc `OPEN`. Race open/block trên MySQL thật đã đạt.
5. **D6-D7 - booking (đã xây dựng):** Professional xem chi tiết slot, hold 10 phút qua cấu hình, expiry/idempotency, confirm atomically, immutable snapshot gồm giá/tên/UTC instant/Salon timezone/local date và UI booking.
6. **D8 - lifecycle (đã xây dựng):** cancellation (>10h reopen), completion worker, Outbox/audit và log-sink notification retry độc lập.
7. **D9 - operations admin (đã xây dựng):** Admin là tài khoản vận hành độc lập qua `AdminAccess`, không phải Owner. Dashboard đọc sức khỏe dữ liệu/vận hành, heartbeat worker, audit và outbox; mutation đầu tiên chỉ khóa/mở tài khoản với reason, idempotency, revoke session và audit.
8. **D9-D10 - hardening/UAT (đang tiếp tục):** MySQL race còn thiếu, browser UAT route/deep-link/back, responsive mobile navigation, backup/restore rehearsal, P0 defect-only and signed go/no-go.
9. **Professional trust follow-up (foundation DB đã thêm, workflow còn lại):** profile onboarding, private upload/finalize, manual Admin review, password-reset request/confirm và email delivery; chỉ sau backfill/UAT mới dùng verification/credential expiry để chặn hold/confirm mới.

## Hợp đồng triển khai trước khi viết feature

| Boundary | Owner | Invariant |
| --- | --- | --- |
| Availability | Slot, hold, calendar lock | Only one valid holder/booking per slot; fixed time only. |
| Booking | Lifecycle, snapshot, cancellation | Confirm and slot transition share one transaction; snapshot preserves Salon timezone/local date. |
| Identity | User, membership, BOLA, Professional access | Owner authority comes only from `SalonMembership`; booking authority comes only from `ProfessionalProfile`. |
| Media | Object metadata, visibility, cover | Only READY media is public; at most 10 per parent. |
| Worker | Expiry, outbox, cleanup | Runs after commit; retries must be idempotent. |
| Web | Discovery UI, owner/admin consoles, booking journey | URL is the navigation source of truth; calls versioned contracts only and never decides availability locally. |

## Acceptance evidence

- Fresh MySQL migration and generated Prisma client succeed.
- Two concurrent holds/confirms yield one winner only.
- Non-Professional, Owner-only and Admin-only accounts cannot create/manage bookings unless they also have an active Professional profile.
- Cross-Salon and cross-user writes are denied.
- Refresh/direct URL/browser-back preserve the intended web journey.
- A booking is displayed in its Salon timezone regardless of browser timezone.
- A failed email/object cleanup never rolls back an already committed booking state.

## Bằng chứng gần nhất — 28/08/2026

- MySQL 8.4 Docker cổng `3307`: áp mới đủ 3 migration thành công.
- D5 race: hai batch open/block đồng thời được serialize, tạo đúng 4 slot và không để trạng thái ngày bị trộn.
- Live HTTP + DB smoke: register → Owner create/publish → open 2 slot → Discovery thấy Workspace → block → Discovery ẩn Workspace; dữ liệu smoke đã dọn.
- API default: 39 suite/99 test đạt; MySQL suite vẫn opt-in và bị skip theo mặc định. Web: 7/7 test đạt. Typecheck toàn monorepo đạt.
- Đã bổ sung Professional profile guard/service, Booking Salon timezone/local-date snapshot, URL navigation và mobile Owner/Admin navigation.
- Request ID được middleware gán trước guard và CORS expose `x-request-id`; Sharp/storage errors được log nội bộ và trả message an toàn.
- Schema additive đã tách verification case, credential và private document; password reset gắn với `User` nên không phụ thuộc Owner/Professional role. Booking guard chưa đổi để tránh regression tài khoản cũ.
- Chưa xác nhận: browser UAT authenticated đầy đủ; race media cap/cleanup; concurrent confirm/cancel; email provider retry.
