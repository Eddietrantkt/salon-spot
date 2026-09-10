# Mentor handoff — hosted POC and verification notes

Ngày cập nhật: 2026-09-10  
Candidate: `46232d3` trên nhánh `codex/vercel-render-aiven-poc`

## Kết luận ngắn

Website công khai đang chạy tại Vercel, API Render và MySQL Aiven đã kết nối
được. Login, refresh session, role-aware navigation, phân quyền Owner/Admin,
discovery, workspace availability, hold và confirm booking đã được kiểm thử
bằng browser thật. Lỗi login trước đó có hai yếu tố: Aiven MySQL từng bị
power-off khiến API không khởi động; UI cũng thiếu timeout nên hiển thị trạng
thái chờ quá lâu. API đã được deploy lại và UI đã có timeout/lỗi được bản địa
hóa.

Hosted POC bật `RUN_WORKERS_IN_API=true`: worker chạy cùng tiến trình API để
outbox notification, hold expiry, booking lifecycle và media cleanup không bị
bỏ trống trên Render Free. Local/Compose và production-style runtime vẫn giữ
API/worker tách tiến trình.

## Các môi trường cần phân biệt

| Môi trường | Thành phần | Trạng thái / ý nghĩa |
| --- | --- | --- |
| Hosted browser | Vercel Vite web → rewrite `/api/*` | URL demo công khai: `https://salon-spot-web-poc.vercel.app/` |
| Hosted API | Render Docker web service `salon-spot-api` | API và worker đồng-located khi `RUN_WORKERS_IN_API=true`; deploy thủ công, `autoDeploy=false` |
| Hosted database | Aiven MySQL Free, TLS | Đang phục vụ POC; có thể power-off khi không hoạt động, không có SLA |
| Local/runtime | Docker Compose, MySQL 8.4, API, worker, web | Baseline tách process; migration chạy trước API/worker; phù hợp UAT/recovery |
| Production target | Vercel + private API/worker + private MySQL hoặc Aiven/R2 sau migration | Chưa phải bằng chứng production; cần secret management, backup/restore, alerting và worker supervisor |

Repo/CI chuẩn Node 24 và pnpm `10.32.0`. Windows host từng quan sát Node 25,
không dùng kết quả host đó để thay thế bằng chứng Node 24/container.

## Phần đã kiểm thử trên hosted web

- Ba tài khoản demo đăng nhập được; refresh cookie/session hoạt động.
- Guest không thấy menu Owner/Admin; direct route bị chặn nếu thiếu capability.
- Owner xem được salon/workspace và availability read-only.
- Professional xem profile ACTIVE, tìm workspace, chọn slot, tạo hold và
  confirm booking; booking mới tồn tại sau logout/login lại.
- Admin xem metrics, account search, audit và outbox; booking mới tăng số
  confirmed và giảm slot open đúng kỳ vọng.
- Notification inbox và worker heartbeat cần kiểm tra lại sau deploy commit có
  worker đồng-located; không coi booking thành công là bằng chứng notification
  đã delivered.

## Những điểm chỉ thuần POC, cần nói rõ với mentor

- Render Free có thể sleep; co-located worker chỉ chạy khi API process đang
  sống, không phải always-on guarantee.
- API và worker dùng chung CPU/memory trong hosted POC. Không bật thêm worker
  process thứ hai trên cùng database nếu `RUN_WORKERS_IN_API=true`.
- Aiven MySQL Free chỉ phù hợp dữ liệu demo ít người dùng, có giới hạn tài
  nguyên/power-off và không có SLA. Không dùng dữ liệu thật.
- Render dùng `MEDIA_STORAGE_ROOT=/tmp/media`; media có thể mất khi restart hoặc
  redeploy. Chưa bật S3/R2 adapter production.
- Notification hiện là in-app/log sink; chưa có email provider thật, provider
  message ID, dead-letter operation hay exactly-once guarantee tới external
  provider.
- Payment, chat, Manager, rescheduling và các capability shell chưa phải
  feature hoàn chỉnh; không trình bày imported shell như đã triển khai.
- `seed-demo` chỉ dành cho database POC cô lập; không chạy trên database thật.
- Commit/push GitHub và trạng thái deployed phải báo riêng; HTTP 200 health
  không tự chứng minh browser render hoặc toàn bộ workflow.

## Checklist khi demo / review

1. Kiểm tra Vercel HTML và browser DOM; không chỉ kiểm tra HTTP 200.
2. Kiểm tra API live/ready, Render deployment source commit và Aiven đang
   Running trước khi test login.
3. Sau một booking mới, kiểm tra cả Admin outbox/heartbeat và inbox
   Professional; expected healthy state là outbox được deliver và notification
   xuất hiện, không chỉ thấy booking `CONFIRMED`.
4. Không publish review, cancel booking, đổi preference hoặc suspend account
   trong demo nếu chưa xác nhận thao tác cuối cùng.
5. Với production handoff, chuyển sang worker riêng có supervisor/orchestrator,
   storage bền vững, backup/restore rehearsal, monitoring và test provider
   retry/idempotency.

## Tài khoản demo

- `owner.demo@salonspot.local`
- `admin.demo@salonspot.local`
- `professional.demo@salonspot.local`

Mật khẩu demo được quản lý ngoài tài liệu handoff; không commit secret vào Git
hoặc gửi trong log/evidence công khai.
