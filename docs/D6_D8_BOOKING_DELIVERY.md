# D6–D8 Booking — bàn giao triển khai

## Kết quả

Đã mở rộng Core MVP từ Discovery chỉ-đọc sang luồng đặt chỗ không Payment:

`Discovery → Workspace detail → OPEN slot → HELD (10 phút) → CONFIRMED → CANCELLED/COMPLETED`.

`AvailabilityModule` sở hữu public detail, `SlotHold`, expiry và mọi chuyển trạng thái slot. `BookingsModule` sở hữu snapshot, confirm, cancel, completion và booking-notification outbox. `ProfessionalsModule` sở hữu policy `ProfessionalProfile ACTIVE` bắt buộc cho mọi hold/booking route; Owner/Admin không tự có quyền booking. Không có controller/UI nào trực tiếp đổi trạng thái slot.

## Hợp đồng HTTP

- `GET /api/v1/workspaces/:workspaceId?date=YYYY-MM-DD`: chỉ Workspace `PUBLISHED`, media `READY` và slot tương lai `OPEN`.
- `POST /api/v1/availability/slots/:slotId/holds`: access token + `Idempotency-Key`; trả `hold` cùng `expiresAt`.
- `GET /api/v1/me/holds`: khôi phục hold chưa hết hạn của người dùng sau refresh.
- `POST /api/v1/holds/:holdId/confirm`: access token + `Idempotency-Key`; tạo Booking `CONFIRMED` không Payment.
- `GET /api/v1/me/bookings` và `GET /api/v1/me/bookings/:bookingId`.
- `POST /api/v1/bookings/:bookingId/cancel`: chỉ chủ Booking; chỉ cho phép khi còn hơn 10 giờ trước giờ bắt đầu.

## Transaction và worker

Mỗi hold/confirm/cancel/expiry lấy `WorkspaceCalendarLock(workspaceId, localDate)` trước rồi mới `SELECT ... FOR UPDATE` slot. Hold chỉ nhận slot tương lai `OPEN`, tạo `SlotHold`, chuyển `OPEN → HELD`, audit và idempotency trong một commit.

`SLOT_HOLD_TTL_SECONDS=600` trong `.env.example`; cấu hình chấp nhận 60–3600 giây. Expiry worker chạy lặp an toàn: chỉ xóa đúng hold hết hạn còn đang gắn với slot `HELD`, rồi chuyển `HELD → OPEN` trong cùng transaction.

Confirm khóa theo cùng thứ tự, xác minh hold đúng Professional/chưa hết hạn, snapshot `workspaceName`, `rentalOptionLabel`, `priceCents`, UTC `startsAt`/`endsAt`, `salonTimezone` và `localDate`, xóa hold và chuyển `HELD → BOOKED` trong một commit. Cancel dùng ngưỡng >10 giờ để `BOOKED → OPEN`. Completion worker đánh dấu booking qua `endsAt` là `COMPLETED`.

Các event `BOOKING_CONFIRMED`, `BOOKING_CANCELLED`, `BOOKING_COMPLETED` được ghi vào `OutboxEvent` trong transaction nghiệp vụ. Worker hiện dùng log sink có lease/retry độc lập; chưa tích hợp nhà cung cấp email nào.

## Web

Thẻ Discovery có nút **Xem và chọn khung giờ**. Web dùng URL cho Discovery query, Workspace detail, Bookings, Owner, Admin và login return path; refresh/direct-link/browser-back không còn dựa vào React page state. Mobile bottom navigation luôn có Owner và Admin. Trang Workspace detail, hold và toàn bộ Booking history hiển thị theo timezone snapshot của Salon, không theo timezone browser.

## Bằng chứng

- API default test: 38 suites/94 tests passed (28/08), gồm D6-D8 unit, worker/outbox, Professional access và HTTP contract.
- MySQL opt-in: 4/4 passed — hai Professional tranh chấp cùng slot, replay idempotency, confirm cross-user bị từ chối, và race expiry/confirm không tạo trạng thái kép.
- Web state test: 7/7 passed; refresh khôi phục mọi hold còn hạn, URL state có typecheck, và timezone formatter có regression test.
- HTTP smoke: `GET /workspaces/:workspaceId?date=2026-08-28` trả 200 và bốn slot cụ thể của Workspace `PUBLISHED`.
- Typecheck và production build toàn monorepo được chạy sau thay đổi.
- Ma trận chi tiết: [D6_D8_STABILITY_TEST_MATRIX.md](./D6_D8_STABILITY_TEST_MATRIX.md).

## Còn lại

- Chưa có email provider; log sink chỉ là adapter UAT/testable.
- Cần D9-D10 UAT với browser automation cho routing/mobile viewport, test retry/worker crash sâu hơn, MySQL race confirm/cancel, và review quyền Admin riêng.
