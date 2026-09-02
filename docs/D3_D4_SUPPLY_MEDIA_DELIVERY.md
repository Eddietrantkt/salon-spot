# D3-D4 Supply & Media – Bàn giao kỹ thuật

## Kết quả

D3-D4 đã có một vertical slice triển khai được từ Owner Console đến API: Owner quản lý Salon/Workspace/RentalOption, tải ảnh trực tiếp bằng signed PUT, finalize ảnh sang `READY`, chọn cover, đổi thứ tự, xóa và publish Workspace qua checklist. Discovery chỉ trả ảnh `READY` của Workspace đã `PUBLISHED` và có slot `OPEN`.

## Luồng authoritative

```text
Owner có SalonMembership(OWNER)
  -> POST upload-intents (khóa parent, giữ giới hạn 10)
  -> PUT signed URL vào staging
  -> POST finalize
     -> stat + decode ảnh thật
     -> JPEG/PNG/WebP allowlist, byte/pixel limit, single-frame
     -> auto-orient + re-encode để bỏ metadata
     -> SHA-256 + dimensions + byte size
     -> Media READY
  -> cover / reorder / delete
  -> GET publish-checklist
  -> POST publish
```

Client không quyết định `storageKey`, URL public, trạng thái, thứ tự authoritative hay điều kiện publish. Workspace route luôn nằm dưới `:salonId`; ngoài `SalonOwnerGuard`, service còn kiểm tra Workspace thực sự thuộc Salon đó.

## API D3-D4

### Salon media

- `POST /api/v1/owner/salons/:salonId/media/upload-intents`
- `POST /api/v1/owner/salons/:salonId/media/:mediaId/finalize`
- `PUT /api/v1/owner/salons/:salonId/media/cover`
- `PUT /api/v1/owner/salons/:salonId/media/order`
- `DELETE /api/v1/owner/salons/:salonId/media/:mediaId`

### Workspace media và publish

- Các media route tương tự dưới `/owner/salons/:salonId/workspaces/:workspaceId/media`.
- `GET /api/v1/owner/salons/:salonId/workspaces/:workspaceId/publish-checklist`
- `POST /api/v1/owner/salons/:salonId/workspaces/:workspaceId/publish`

### Upload/public content

- `PUT /api/v1/media/uploads/:signedToken`
- `GET /api/v1/media/salons/:mediaId`
- `GET /api/v1/media/workspaces/:mediaId`

Public content trả 404 nếu media chưa `READY`. Signed token gắn với key, MIME, max bytes và expiry. Adapter hiện tại lưu object tại `MEDIA_STORAGE_ROOT`, phù hợp local/dev/UAT; production cần adapter S3-compatible/CDN nhưng không thay đổi contract nghiệp vụ.

## Invariant và transaction

- Tối đa 10 media active trên mỗi Salon/Workspace; parent row được `SELECT ... FOR UPDATE` trước count/create.
- Cover chỉ nhận media `READY` đúng parent; cover là tùy chọn và parent giữ `coverMediaId` duy nhất.
- Reorder yêu cầu đúng toàn bộ tập ID `READY`, không trùng, rồi cập nhật trong một transaction.
- Delete clear cover nếu cần, chuyển `DELETE_PENDING`, ghi audit + outbox trong transaction. Worker xóa object sau commit, retry có backoff, rồi chuyển `DELETED`.
- Publish yêu cầu thông tin Salon, tên Workspace, ít nhất một RentalOption hợp lệ và không còn media `PENDING_UPLOAD`/`PROCESSING`. Ảnh không bắt buộc.

## Cấu hình

- `MEDIA_UPLOAD_SECRET`: secret riêng tối thiểu 32 ký tự.
- `MEDIA_PUBLIC_BASE_URL`: base URL công khai của API.
- `MEDIA_STORAGE_ROOT`: thư mục object local.
- `MEDIA_UPLOAD_TTL_SECONDS`: mặc định 900.
- `MEDIA_MAX_UPLOAD_BYTES`: mặc định 10 MB.
- `MEDIA_MAX_PIXEL_COUNT`: mặc định 40 triệu pixel.

Intent quá hạn được worker chuyển sang `REJECTED` sau một khoảng grace cho request đang truyền và tạo cleanup outbox. Staging object sau finalize/reject được giữ đến khi signed token hết hạn để chặn replay, rồi xóa qua cùng cơ chế retry thay vì phụ thuộc request còn sống. Record `PROCESSING` bị gián đoạn được worker trả về trạng thái retryable trước khi áp expiry.

## Bằng chứng ngày 25/08/2026

- Contracts build: đạt.
- Prisma generate + schema validate: đạt.
- API/web typecheck: đạt.
- API tests: 17 suites, 34 tests đạt.
- API build và web production build: đạt.
- Storage test dùng filesystem + `sharp` thật, không mock bước decode/re-encode.

## Chưa xác minh

Docker Desktop Linux engine không khả dụng, nên migration `20260825100000_supply_media_metadata`, lock/count concurrent, transaction publish/delete và cleanup worker chưa được chạy trên MySQL 8.4 thật. Đây là gate trước UAT; test mock/in-process không thay thế bằng chứng database runtime.
