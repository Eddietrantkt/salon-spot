# Hướng dẫn kiểm thử thủ công — The Salon Spot

## 1. Phạm vi thật của bản hiện tại

Đây là checklist dành cho Tester kiểm tra các chức năng đã có: đăng ký/đăng nhập, phục hồi phiên, Owner tạo Salon/Workspace, ảnh, publish, fixed slots, Discovery và luồng Professional hold → confirm → cancel/complete. Chỉ account có `ProfessionalProfile ACTIVE` được ghi nhận Booking; Owner/Admin không tự có quyền này.

Khung giờ hiện hành cố định 2 giờ: `09:00–11:00`, `11:00–13:00`, `13:00–15:00`, `15:00–17:00`, theo múi giờ của Salon. Không có ô nhập giờ tự do.

## 2. Chuẩn bị môi trường kiểm thử

1. Mở PowerShell tại thư mục dự án.
2. Kiểm tra MySQL Docker và ghi nhận cổng đang publish:

   ```powershell
   docker compose ps
   ```

3. Đảm bảo `DATABASE_URL` trong `.env` trỏ đúng cổng Docker. Nếu MySQL local đang chiếm `3306`, cấu hình Docker có thể dùng `3307`; API phải dùng cùng cổng đó. Không đưa mật khẩu thật vào ảnh chụp màn hình hoặc báo cáo lỗi.
4. Tạo Prisma Client và áp dụng các migration đã có. Không chạy `migrate dev` chỉ để khởi động:

   ```powershell
   pnpm prisma:generate
   Push-Location apps/api
   pnpm exec prisma migrate deploy --schema prisma/schema.prisma
   Pop-Location
   ```

5. Mở ba cửa sổ PowerShell riêng:

   ```powershell
   pnpm --filter @salon-spot/api dev
   ```

   ```powershell
   pnpm --filter @salon-spot/web dev
   ```

   ```powershell
   pnpm --filter @salon-spot/api worker:dev
   ```

6. Mở `http://localhost:5173` và xác nhận `http://localhost:3000/api/v1/health` trả HTTP 200.
7. Tạo một mã đợt test, ví dụ `QA-20260826-01`. Mọi email test cần duy nhất, ví dụ `qa.owner.20260826.01@example.test`. Không dùng tài khoản hoặc ảnh thật.

## 3. Bộ test giao diện và API

| ID | Chức năng | Các bước | Kết quả mong đợi |
| --- | --- | --- | --- |
| AUTH-01 | Đăng ký Owner | Mở **Owner Console** → đăng ký bằng email test, mật khẩu từ 8 ký tự, tên hiển thị. | Đăng nhập thành công, thấy form tạo Salon; không lộ refresh token trên màn hình. |
| AUTH-02 | Khôi phục phiên | Sau AUTH-01, tải lại trang Owner Console. | Phiên được khôi phục; không yêu cầu đăng nhập lại. |
| AUTH-03 | Sai mật khẩu | Đăng xuất → đăng nhập cùng email với mật khẩu sai. | Không đăng nhập; có thông báo lỗi rõ ràng; dữ liệu Owner không hiển thị. |
| AUTH-04 | Đăng xuất | Đăng xuất → tải lại Owner Console. | Phải yêu cầu đăng nhập lại. |
| OWN-01 | Tạo Salon/Workspace | Đăng nhập → nhập tên Salon, khu vực, chọn **Việt Nam — GMT+7**, tên Workspace, gói thuê và giá dương → tạo. | Một Salon và Workspace `DRAFT` xuất hiện; không sinh bản sao khi màn hình phản hồi chậm. |
| OWN-02 | Múi giờ chọn sẵn | Mở form tạo Salon. | Trường là danh sách chọn, không yêu cầu gõ `Asia/Ho_Chi_Minh`; giá trị lưu là mã IANA tương ứng. |
| OWN-03 | Chống dữ liệu rỗng | Nhập khoảng trắng cho tên Salon/Workspace hoặc gói thuê rồi gửi. | API trả 400; không tạo bản ghi. Ghi nhận `requestId` nếu có lỗi. |
| OWN-04 | Thêm Workspace | Từ Salon đã có → **Thêm Workspace** → nhập dữ liệu hợp lệ. | Workspace mới thuộc đúng Salon, trạng thái `DRAFT`. |
| MEDIA-01 | Upload ảnh hợp lệ | Chọn JPEG/PNG/WebP thật, kích thước không quá 10 MB. | Ảnh chuyển sang `READY`, hiển thị preview và có thể đặt cover/sắp xếp/xóa. |
| MEDIA-02 | Upload không hợp lệ | Dùng file không phải JPEG/PNG/WebP hoặc file quá giới hạn. | API từ chối; không có ảnh public `READY`. |
| MEDIA-03 | Giới hạn ảnh | Thử thêm ảnh thứ 11 còn hoạt động cho cùng Salon/Workspace. | Bị chặn, không tạo thêm metadata ảnh. |
| MEDIA-04 | Xóa ảnh | Với một ảnh `READY`, bấm **Xóa** một lần. | Ảnh biến mất khỏi danh sách ngay, không cần tải lại trang; cover được bỏ nếu đó là cover. Worker dọn tệp vật lý ở nền. |
| PUB-01 | Publish Workspace hợp lệ | Workspace có tên và ít nhất một gói thuê giá dương → chọn **Publish**. | Checklist đạt và trạng thái thành `PUBLISHED`; ảnh là tùy chọn nếu không còn ảnh đang xử lý. |
| PUB-02 | Publish khi ảnh đang xử lý | Bấm Publish ngay trong khi upload/finalize ảnh chưa hoàn tất. | Bị chặn; checklist nêu ảnh đang xử lý. |
| AVL-01 | Mở fixed slots | Với Workspace `PUBLISHED`, chọn ngày tương lai và một hoặc nhiều khung → **Mở**. | Các khung chuyển `OPEN`; bấm **Xem trạng thái** thấy đúng trạng thái; retry cùng idempotency key không tạo trùng. |
| AVL-02 | Block/reopen | Chọn slot `OPEN` → **Chặn**, kiểm tra Discovery; sau đó chọn lại → **Mở**. | `BLOCKED` biến khỏi Discovery; reopen trả về `OPEN`; có audit cho cả hai thao tác. |
| AVL-03 | Ngày bất biến | Gọi API mở/block với ngày hiện tại hoặc quá khứ theo timezone Salon. | HTTP 400 với code `PAST_SLOT_IMMUTABLE`; không có slot/lock/audit mutation được commit. |
| AVL-04 | Batch bất biến | Khi có dữ liệu `HELD`/`BOOKED` từ test fixture D6 về sau, gửi batch chứa slot đó và slot `OPEN`. | Toàn batch bị từ chối; code lần lượt là `ACTIVE_CHECKOUT_IMPACT`/`BOOKED_SLOT_IMMUTABLE`; slot còn lại không đổi. |
| BKG-01 | Role Professional | Đăng nhập Owner hoặc Admin demo, thử giữ slot công khai qua UI/API. | Bị từ chối `403`; không có SlotHold/Booking mới. |
| BKG-02 | Hold và confirm | Đăng nhập Professional demo, chọn slot `OPEN`, giữ rồi confirm. | Hold 10 phút, Booking `CONFIRMED`, slot thành `BOOKED`; thời gian hiển thị theo timezone Salon. |
| WEB-01 | Refresh/direct link/back | Mở trực tiếp `/owner`, `/admin`, `/bookings` và `/workspaces/:id?date=...`; refresh rồi dùng Back. | Đúng page/journey từ URL; mobile navigation luôn có Owner và Admin. |
| SEC-01 | Phân quyền Owner | Tạo Owner B, đăng nhập Owner B và thử dùng URL/API ID Salon của Owner A qua DevTools. | Nhận 403/404; không đọc hoặc sửa được Salon của Owner A. |
| INT-01 | Retry tạo Workspace | Trong DevTools Network, resend cùng request tạo Workspace với **cùng `Idempotency-Key`**. | Hai response trả cùng Workspace ID; DB chỉ có một Workspace mới. |
| DISC-01 | Trang Discovery | Sau AVL-01, chọn đúng khu vực/ngày và tìm; sau đó block toàn bộ slot rồi tìm lại. | Workspace có ít nhất một `OPEN` slot xuất hiện với đúng số slot; biến khỏi kết quả khi không còn slot `OPEN`. |

## 4. Quy tắc ghi nhận kết quả

Mỗi case cần ghi: ID case, thời gian, môi trường/cổng DB, tài khoản test, input đã dùng (không gồm mật khẩu), kết quả thực tế, HTTP status/requestId khi lỗi, ảnh chụp màn hình và Pass/Fail/Blocked.

Chỉ ghi **Pass** khi kết quả thực tế khớp hoàn toàn. Không dùng SQL để tự tạo Booking rồi coi đó là luồng người dùng hoàn chỉnh. Ghi **Blocked** cho browser routing/responsive hoặc MySQL race khi môi trường test chưa chạy được, kèm URL, viewport, HTTP status và `requestId` nếu có.

## 5. Kiểm thử tự động trước khi báo lỗi

Chạy các lệnh sau và đính kèm output rút gọn vào báo cáo:

```powershell
pnpm --filter @salon-spot/api test -- --silent
pnpm --filter @salon-spot/api typecheck
pnpm --filter @salon-spot/web typecheck
pnpm --filter @salon-spot/web build
```

Nếu lỗi chỉ xuất hiện khi chạy Docker, đính kèm `docker compose ps`, log API liên quan và `requestId`; tuyệt đối loại bỏ cookie, bearer token, mật khẩu và chuỗi kết nối khỏi báo cáo.

## 6. Gate P1 bắt buộc trước GO/NO-GO

Ngoài các case ở trên, chạy và ghi từng dòng vào `docs/P1_TEST_EVIDENCE.md`:

1. **P1-UAT-01 BOLA mutation:** Owner A thử sửa Salon/Workspace Owner B; lặp lại URL/request bằng Admin và Professional. Chụp response `403`, request ID và đếm DB trước/sau để chứng minh không có mutation.
2. **P1-UAT-02 capability:** tạo Professional `PENDING`, thử hold/confirm; chỉ sau khi chuyển profile thành `ACTIVE` trong fixture kiểm thử mới thử lại. Không dùng Admin/Owner để thay cho capability Professional.
3. **P1-UAT-03 session revocation:** Admin suspend user disposable có access và refresh session; access cũ và refresh cũ đều phải fail. Reactivate chỉ cho login mới, không hồi sinh refresh token cũ.
4. **P1-UAT-04 timezone:** dùng hai Salon timezone và hai browser timezone, kiểm tra My Bookings luôn dùng `salonTimezone`/`localDate` snapshot, không dùng timezone máy test.
5. **P1-UAT-05 mobile:** chụp navigation role-specific ở 320, 375, 768 px và mở trực tiếp/refresh/back cho Discovery, detail, bookings, Owner, Admin, onboarding.

Sau đó chạy `pnpm p1:mysql`, `pnpm p1:runtime-smoke`, `pnpm p1:browser` và `pnpm p1:backup-restore` với môi trường disposable. Không ký GO nếu một evidence còn `PENDING`, `FAIL` hoặc `BLOCKED`.
