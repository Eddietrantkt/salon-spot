# MUST-FIX hardening delivery — 28/08/2026

## Phạm vi hoàn thành

- Thêm `ProfessionalProfile` độc lập với Owner/Admin, trạng thái `ACTIVE`/`SUSPENDED`, migration và local operations command `professional:grant`.
- Enforce profile tại HTTP guard **và** lại trong transaction của hold, confirm, cancel, đọc danh sách/chi tiết Booking. Owner/Admin không được suy diễn là Professional.
- Snapshot `Booking.salonTimezone` và `Booking.localDate` khi confirm; Booking history/summary render theo snapshot Salon thay vì timezone browser.
- Dùng History API làm URL router cho Discovery query, Workspace detail, My Bookings, Owner, Admin và login return path. Mobile bottom navigation có đủ Owner/Admin.
- `RequestIdMiddleware` chạy trước guard; mọi 401/403 trả `x-request-id` và `requestId` trong error body. CORS expose header này cho web.
- Raw Sharp/storage errors chỉ còn trong server log kèm `mediaId`/`requestId`; DB, audit và client nhận message xử lý ảnh an toàn.
- Đồng bộ `README`, architecture, module map, build plan, test strategy và runbook với trạng thái mã nguồn hiện hành.

## Bằng chứng đã chạy

- API typecheck: pass.
- API default test: 39 suites / 99 tests pass; MySQL opt-in suite vẫn skip mặc định (4 tests).
- Web regression: 7/7 pass, gồm formatter theo Salon timezone/local date.
- Web production build: pass.
- Browser cục bộ: direct `/owner` và `/workspaces/:id?area=&date=`, refresh, browser-back `/admin → /owner`, mobile 375px có Owner/Admin và không tràn ngang.

## Còn để sau theo scope

- Quyết định/cập nhật checklist về ảnh có bắt buộc khi publish hay không (code hiện hành: không bắt buộc).
- MySQL race chuyên biệt: media-cap, cleanup retry và concurrent confirm/cancel; full authenticated browser/UAT đa timezone.
