# D6–D8 — ma trận kiểm thử ổn định và liên kết component

Ngày chạy: 27/08/2026. Phạm vi là các phần mới D6–D8, không suy diễn rằng Payment, email provider hay browser UAT đã hoàn tất.

## Luồng và test case

| Luồng liên kết | Test case mới/được mở rộng | Kết quả mong đợi |
| --- | --- | --- |
| Workspace detail → Availability | HTTP `GET /workspaces/:workspaceId?date=YYYY-MM-DD`; từ chối ngày sai | Controller chỉ gọi public-detail service với ngày hợp lệ |
| Professional → hold | Không token trả 401; profile thiếu/suspended trả 403; thiếu `Idempotency-Key` trả 400; token/key/request id được chuyển nguyên vẹn vào `SlotHoldsService` | Không phát sinh hold khi thiếu quyền; retry có cùng context |
| Refresh → checkout | `GET /me/holds` trả holds của caller; UI lọc hold hết hạn và sắp xếp các hold còn hạn | Không còn mất các hold thứ hai/trở đi sau refresh |
| Hold → confirm | Controller buộc token/profile/key; service từ chối hold của user khác | Chỉ Professional đang giữ hold tạo được Booking |
| Confirm/cancel → booking UI | `/me/bookings`, `/me/bookings/:id`, cancel đều yêu cầu Professional profile và trả snapshot timezone/local date | UI/API không trực tiếp thay slot; history không dùng timezone browser |
| Cancel → inventory/outbox | Hủy trước 11 giờ chuyển slot về `OPEN`, ghi `BOOKING_CANCELLED` | Đúng rule mở lại hơn 10 giờ |
| Hold expiry ↔ confirm | MySQL thật chạy đồng thời expiry và confirm | Trạng thái cuối chỉ `OPEN` hoặc `BOOKED`; không còn hold và không có trạng thái kép |
| Hai Professional cùng hold | MySQL thật tranh chấp một slot, replay idempotency và confirm cross-user | Chỉ một winner, replay trả đúng hold cũ, caller khác bị từ chối |
| Completion → notification | Worker chạy completion trước outbox; outbox chỉ claim/deliver một lần | Worker lặp an toàn, event không gửi đôi khi claim đã mất |

## Lệnh và bằng chứng

- `pnpm --filter @salon-spot/api test -- src/common`: 7 suites, 9 tests passed.
- `pnpm --filter @salon-spot/api test -- src/modules/availability src/modules/bookings`: 5 suites, 20 tests passed.
- `pnpm --filter @salon-spot/api test -- src/modules/auth src/modules/discovery src/modules/media src/modules/salons src/modules/workspaces`: 18 suites, 40 tests passed.
- Hai HTTP-contract suite: 2 suites, 9 tests passed. Tổng API mặc định đã chạy theo nhóm: 32 suites, 78 tests passed; MySQL suite được skip khi không bật biến môi trường.
- `RUN_MYSQL_E2E=1 pnpm --filter @salon-spot/api test -- availability.mysql.spec.ts`: 1 suite, 4 tests passed, dùng MySQL Docker cổng 3307.
- `pnpm --filter @salon-spot/web test`: 4 tests passed.
- `pnpm typecheck` và `pnpm build`: passed cho contracts, API và web.

## Giới hạn còn lại

- Chưa có browser automation/visual UAT thật cho countdown, timezone và conflict banner.
- Outbox mới xác nhận log-sink testable; retry với lỗi nhà cung cấp email thật sẽ chỉ kiểm được sau khi có adapter/provider được duyệt.
- Chưa làm chaos test khi MySQL mất kết nối giữa worker ticks hoặc backup/restore rehearsal (D9–D10).
