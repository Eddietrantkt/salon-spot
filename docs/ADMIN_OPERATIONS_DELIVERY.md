# D9 — System Admin Operations

## Mục tiêu và ranh giới

Admin là tài khoản bảo trì nền tảng độc lập với Owner. `AdminAccess` không dùng `SalonMembership`, không cấp quyền quản lý Salon và không có luồng đăng ký công khai.

Admin có thể quan sát tình trạng dữ liệu/vận hành, tra cứu người dùng, audit, Outbox và heartbeat worker; đồng thời khóa/mở lại tài khoản thông thường. Không có SQL console, xóa cứng dữ liệu, sửa trực tiếp slot/hold/Booking, hay quyền tự cấp Admin từ giao diện.

## Schema và bảo mật

- `User.status`: `ACTIVE` hoặc `SUSPENDED`.
- `AdminAccess(userId)`: grant toàn hệ thống cho đúng một `User`, tách riêng hoàn toàn khỏi `SalonMembership`.
- `WorkerHeartbeat`: batch thành công/thất bại cuối cùng của `hold-expiry`, `booking-lifecycle` và `media-cleanup`. Dashboard coi success cũ hơn 15 giây là `STALE`, lỗi mới hơn success là `FAILED`; chưa từng chạy là `UNKNOWN`.
- `AccessTokenGuard` đọc trạng thái tài khoản từ DB trên mọi API có Bearer token. Tài khoản `SUSPENDED` mất quyền ngay, kể cả access token còn hạn.
- Khi Admin suspend tài khoản, refresh session chưa revoke bị revoke trong transaction; login/refresh sau đó bị từ chối.
- `AdminGuard` chỉ kiểm `AdminAccess`; Owner không tự trở thành Admin.
- Mọi đổi trạng thái bắt buộc `Idempotency-Key`, lý do 3–255 ký tự, `x-request-id` và `AuditEvent` có trạng thái trước/sau.
- Không suspend được chính mình hoặc một tài khoản Admin qua giao diện. Hai tình huống này cần break-glass procedure được duyệt riêng, tránh tự khóa đội vận hành.

## API hiện có

Mọi route sau yêu cầu Bearer token của tài khoản có `AdminAccess`:

| Method | Route | Chức năng |
| --- | --- | --- |
| `GET` | `/api/v1/admin/overview` | Tổng số User, Salon, Workspace, Booking, slot, Outbox và trạng thái heartbeat Worker. |
| `GET` | `/api/v1/admin/users?search=&status=&page=&pageSize=` | Danh sách/tìm kiếm User, không trả password hay refresh token. |
| `PUT` | `/api/v1/admin/users/:userId/status` | Khóa/mở User thường; body `{ status, reason }`, bắt buộc `Idempotency-Key`. |
| `GET` | `/api/v1/admin/audit-events` | 50 audit event mới nhất, không trả payload nhạy cảm. |
| `GET` | `/api/v1/admin/outbox-events` | 50 event Outbox mới nhất, không trả payload.

## Cấp Admin đầu tiên

1. Đăng ký một tài khoản bình thường trên web trước.
2. Áp dụng migration `20260827120000_admin_operations` vào MySQL.
3. Từ máy vận hành có quyền truy cập database, chạy:

   ```powershell
   pnpm --filter @salon-spot/api admin:grant -- admin@example.com
   ```

Lệnh chỉ nhận một email đã tồn tại, upsert `AdminAccess` và ghi `ADMIN_ACCESS_GRANTED` vào audit. Không truyền mật khẩu, token hoặc chuỗi kết nối qua tham số lệnh.

Sau đó vào **System Admin** tại web app và đăng nhập bằng chính tài khoản đó. Màn này không có chức năng đăng ký Admin.

## Giới hạn chủ ý

Chưa có cấp/thu hồi Admin qua UI, dashboard metrics lịch sử, moderation/ẩn Workspace, retry Outbox thủ công, backup/restore hay break-glass. Các thao tác này cần policy riêng vì chúng có thể ảnh hưởng trạng thái Booking, worker hoặc khả năng khôi phục vận hành.
