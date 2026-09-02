# Owner session và toàn vẹn ghi dữ liệu

## Mục tiêu

Khắc phục các lỗi runtime đã tái hiện ở Owner Console: reload làm mất login, access token hết hạn không tự hồi phục, dữ liệu khoảng trắng được ghi, cover nhận payload thiếu/rỗng, và retry tạo Workspace sinh bản sao.

## Quyết định triển khai

- Refresh token không còn nằm trong JSON response hoặc JavaScript. API set cookie `salon_spot_refresh` với `HttpOnly`, `SameSite=Lax`, path `/api/v1/auth`; `Secure` khi `NODE_ENV=production`.
- Web gọi `POST /auth/refresh` khi Owner Console khởi tạo. Khi một request Owner nhận 401, web refresh đúng một lần và retry; refresh thất bại sẽ xóa state và yêu cầu login lại.
- `POST /owner/salons` và `POST /owner/salons/:salonId/workspaces` bắt buộc `Idempotency-Key`. Cùng Owner + scope + key + payload trả lại response đầu tiên; tái sử dụng key với payload khác trả conflict.
- Chuỗi Salon/Workspace/RentalOption được trim trước validation. Chuỗi rỗng sau trim bị trả 400 và không ghi DB.
- `PUT .../media/cover` yêu cầu `mediaId` phải là `null` rõ ràng hoặc ID không rỗng.
- API lỗi dùng chung `{ code, message, requestId }`; web nhận được HTTP status/code để refresh session và hiển thị lỗi có ngữ cảnh.
- Discovery tạo ngày mặc định theo local calendar thay vì UTC.

## Xác minh

E2E MySQL cục bộ ngày 26/08/2026 đã xác nhận: refresh cookie 200, logout revoke refresh (401), hai POST Workspace cùng key trả cùng một ID và chỉ ghi một row, payload khoảng trắng/cover thiếu/cover rỗng đều trả 400. Test API đạt 21 suites/42 tests; API typecheck và web production build đạt.

## Giới hạn còn lại

HTTP E2E Jest có sẵn nhưng hiện bị loại khỏi Jest mặc định do cấu hình ESM contracts cũ. Không bật cưỡng bức trong lát sửa này để không làm hỏng command test hiện hành; cần một Jest E2E config riêng ở hardening. Workspace web chưa có React test runner để tự động hóa reload UI, nhưng API cookie flow đã có E2E runtime evidence.
