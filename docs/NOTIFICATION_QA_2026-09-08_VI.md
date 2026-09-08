# Kiểm thử tính năng mới — Notification

Ngày: 08/09/2026. Candidate: HEAD `b7d8025` cộng thay đổi local chưa commit tại thời điểm chạy. Đây là bằng chứng local, không phải Hosted CI hay chứng nhận production.

## Kết luận

Notification foundation hoạt động trong các ca API, MySQL và trình duyệt đã chạy. Hai finding NQA-001 và NQA-002 đã được sửa: danh sách có thể tải tiếp sau 50 thông báo, và nút trên thông báo mở đúng booking cho cả Professional lẫn Owner có quyền xem.

Chat, reviews/trust và Admin mở rộng vẫn thuộc kế hoạch; không đánh dấu các module khung là tính năng đã hoàn thành. Tài liệu PLAN_COMMUNICATION_REVIEWS_ADMIN mô tả baseline trước Notification; NOTIFICATION_FOUNDATION_DELIVERY và source hiện tại đã có inbox.

## Phạm vi và bằng chứng

| Yêu cầu | Source / baseline | Kiểm thử thực hiện | Kết quả / giới hạn |
| --- | --- | --- | --- |
| Tạo thông báo xác nhận/hủy/hoàn tất | NotificationOutboxProcessor | MySQL: đưa ba loại event vào outbox; chạy hai processor đồng thời; kiểm tra recipient, type, delivery và trạng thái event | PASS: mỗi event có đúng Owner + Professional, mỗi thông báo có một IN_APP delivery. Ca này đưa event trực tiếp vào outbox, không chứng minh toàn bộ vòng đời booking qua browser |
| Khôi phục xử lý event hết lease, không trùng | availability.mysql.spec.ts | Reclaim PROCESSING đã hết hạn, xử lý lại và đếm bản ghi | PASS |
| Đăng nhập và phân quyền inbox | NotificationsController / NotificationsService | HTTP với guard thật + DB: chưa đăng nhập 401; ID người khác 404; không đổi readAt | PASS |
| Phân trang và lọc đã/chưa đọc | NotificationsService.listMine / NotificationsPage | HTTP page 1/2 khác nhau, total đúng; browser tải 50 rồi tải mục 51; lọc sau mutation | PASS ở API và web |
| Đánh dấu một thông báo đã đọc | executeIdempotently + markRead | HTTP replay cùng key, so sánh response và DB readAt; thao tác browser | PASS |
| Đánh dấu tất cả | markAllRead | DB người khác giữ nguyên; browser có 51 item, tất cả 51 được đánh dấu | PASS |
| Tùy chọn nhận thông báo | NotificationPreference | PATCH/GET/DB; payload sai 400, dùng lại key với payload khác 409; reload browser | PASS; email chỉ lưu tùy chọn, chưa gửi thật |
| EN/VI và mobile | NotificationsPage / notification-copy | Chromium, chuyển VI, viewport 390x844, không tràn ngang; screenshot | PASS trong kịch bản đã chạy |
| Mở booking | app.tsx / MyBookingsPage / BookingsService | Browser Professional mở URL có bookingId và đúng card booking thật; MySQL kiểm tra Owner cùng Salon được xem, Owner khác nhận 404 | PASS; chỉ Professional nhận quyền hủy |

## Kết quả lệnh

- `pnpm test` cuối: API 45 suites / 119 tests PASS, 22 MySQL tests bị bỏ qua theo thiết kế; web 15/15 PASS; routing 1/1 PASS.
- `pnpm typecheck`: PASS.
- `pnpm build`: PASS cho contracts, API và web; Vite 55 modules.
- `pnpm p1:mysql` lần đầu trên DB mới: 9 migration thành công, 4 suites / 16 tests PASS.
- Bộ HTTP inbox bổ sung: 1 suite / 5 tests PASS độc lập.
- `pnpm p1:mysql` cuối sau khi tích hợp test mới và kiểm tra quyền xem booking: **5 suites / 22 tests PASS**, 48.149 giây; không bỏ qua suite nào trong gate.
- `node scripts/p1/notification-browser-qa.mjs`: **7 nhóm kiểm tra PASS, không còn finding**. Dùng web Vite, API đã build, MySQL và booking thật, đăng ký tài khoản/refresh cookie thật; không mock API. Notification được seed trực tiếp để tạo chính xác 51 mục; booking đích là bản ghi quan hệ thật.
- `git diff --check`: PASS, chỉ có cảnh báo LF/CRLF.

Browser evidence cuối: `artifacts/notification-qa/1788848643835/report.json`, `desktop.png`, `mobile-vi.png`. Đây là artifact local không nằm trong Git.

## Findings

### NQA-001 — P2: Không xem được thông báo cũ hơn trang đầu — Đã sửa

Nguyên nhân: web cố định page=1, pageSize=50 và bỏ qua meta. Sửa bằng cách truyền page vào API client, giữ page/total tại NotificationsPage và hiển thị “Load more / Tải thêm”. Browser xác nhận 50 mục ban đầu rồi đủ 51 mục sau khi tải thêm, không trùng.

Khi đánh dấu đã đọc trong bộ lọc unread, total giảm theo mutation; đánh dấu tất cả đưa total về 0, tránh nút tải thêm giả.

### NQA-002 — Điều hướng chưa tới đúng booking — Đã sửa

Nguyên nhân: router bỏ bookingId và trang bookings chỉ tải danh sách của Professional. Sửa bằng URL `/bookings?bookingId=...`, tải một booking cụ thể và làm nổi card đích. API detail cho phép Professional của booking hoặc thành viên Salon xem; phản hồi `viewerCanCancel` bảo đảm giao diện chỉ hiện nút hủy cho Professional. MySQL xác nhận Owner đúng Salon nhận 200, Owner khác nhận 404.

## Các lần chạy chưa qua và nguyên nhân

- Browser harness lần đầu: sourceEventId fixture dài hơn schema; đã rút ngắn fixture, không sửa schema.
- Browser harness lần hai: locator exact của label select không khớp; đã đổi locator theo form, không sửa UI.
- Một lần gọi lại p1:mysql gặp EPERM khi Prisma thay DLL đang được API kiểm thử giữ. Dừng API kiểm thử rồi chạy lại full gate PASS. Đây là xung đột công cụ trên Windows, không phải test nghiệp vụ thất bại.
- Một browser run chạy đồng thời với full suite nhận 500 khi đăng ký; endpoint ngay sau đó trả 201 và browser run độc lập PASS. Chưa có bằng chứng để gán nguyên nhân cho product; giữ lại như lần chạy không sạch.
- Log cảnh báo media cleanup retry và watchdog trong các test mặc định là tình huống lỗi được chủ động mô phỏng; verdict các suite vẫn PASS.

## Thay đổi của đợt QA

- Thêm `apps/api/test/notifications-inbox.mysql.spec.ts`: 5 ca HTTP/DB thật, fixture riêng và cleanup.
- Bổ sung một ca ba loại event / hai processor vào `apps/api/test/availability.mysql.spec.ts`.
- Thêm suite inbox vào `scripts/p1/run-mysql-e2e.mjs` để gate không bỏ quên kiểm thử mới.
- Thêm `scripts/p1/notification-browser-qa.mjs`: regression harness yêu cầu tải đủ mục 51 và mở đúng booking thật.
- Sửa API/contract để đọc booking detail theo quan hệ người tham gia và trả quyền hủy; không đổi schema DB.
- Sửa web để tải thêm, deep-link đúng booking và làm nổi card đích.
- Không commit/push.

## Cách chạy lại và phần chưa kiểm chứng

Chỉ dùng DB MySQL bỏ được. Với browser harness, DATABASE_URL phải trỏ localhost/127.0.0.1 và database `notification_qa`; API phải dùng cùng DB. Khởi động web với VITE_DEV_API_ORIGIN trỏ API riêng, đặt NOTIFICATION_QA_BASE_URL trỏ web rồi chạy harness. Dừng API trước khi chạy p1:mysql trên Windows để tránh khóa DLL Prisma.

Chưa chạy packaged Compose runtime recovery/watchdog/restart gate, hosted CI, email/push provider, hoặc toàn bộ booking-to-worker-to-browser end-to-end trong đợt này. Chưa kiểm tra phiên access token hết hạn khi để inbox mở lâu, cập nhật badge thời gian thực và thao tác nhanh đổi bộ lọc. Không suy rộng PASS local thành production-ready.

Môi trường QA dùng container MySQL riêng `salon-spot-notification-qa-20260908`; không sử dụng DB của các stack salon-spot-poc/salon_spot đang chạy. Tài khoản browser và fixture được cleanup; API/web QA dừng sau chạy, container QA được xóa riêng.
