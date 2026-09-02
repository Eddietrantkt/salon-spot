# D5 Availability — bàn giao triển khai

## Mục tiêu và kết quả

D5 hoàn thiện inventory fixed-slot từ Owner Console đến API và MySQL. Owner có thể xem trạng thái theo ngày, mở/reopen hoặc block theo batch bốn khung cố định. Discovery tiếp tục chỉ hiển thị Workspace `PUBLISHED` có ít nhất một slot `OPEN`.

## Hợp đồng HTTP

Tất cả route dưới đây cần access token, `SalonOwnerGuard` và cặp `:salonId/:workspaceId` đúng quyền sở hữu:

- `GET /api/v1/owner/salons/:salonId/workspaces/:workspaceId/availability/fixed-slots?localDate=YYYY-MM-DD`
- `POST /api/v1/owner/salons/:salonId/workspaces/:workspaceId/availability/open-fixed-slots`
- `POST /api/v1/owner/salons/:salonId/workspaces/:workspaceId/availability/block-fixed-slots`

Hai mutation nhận `Idempotency-Key` và body:

```json
{
  "localDate": "2099-12-11",
  "periods": ["09:00-11:00", "11:00-13:00"]
}
```

Response trả ngày cùng toàn bộ slot đã tồn tại của Workspace/ngày, gồm `id`, `period`, UTC `startsAt/endsAt` và `status`.

## Quy tắc và transaction

- Chỉ Workspace `PUBLISHED`, có RentalOption và ngày tương lai theo IANA timezone của Salon mới được mutate.
- Chỉ bốn fixed periods của MVP được chấp nhận; batch không rỗng và không trùng period.
- Mỗi mutation bootstrap `WorkspaceCalendarLock` bằng `createMany(skipDuplicates)`, sau đó `SELECT ... FOR UPDATE` trước khi đọc/ghi slot.
- `OPEN <-> BLOCKED` được phép. Slot chưa tồn tại được tạo thẳng ở trạng thái mong muốn.
- Chạm `HELD` làm toàn batch thất bại với `ACTIVE_CHECKOUT_IMPACT`; chạm `BOOKED` thất bại với `BOOKED_SLOT_IMMUTABLE`; ngày hiện tại/quá khứ dùng `PAST_SLOT_IMMUTABLE`.
- Audit và idempotency record commit trong cùng transaction với thay đổi slot.
- D6 hold/expiry phải dùng đúng khóa Workspace/ngày và thứ tự khóa này; không được chuyển slot bằng query rời.

## Thay đổi so với trạng thái trước

- Trước: chỉ có endpoint tạo `OPEN` dùng `upsert` lock, chưa block/reopen, chưa đọc lịch Owner và chưa bảo vệ `HELD/BOOKED`.
- Sau: có API + UI quản lý lịch đầy đủ cho D5, domain error code được giữ qua exception filter, và race bootstrap lock đã được sửa theo lỗi quan sát trực tiếp trên MySQL.
- Không đổi schema: `WorkspaceCalendarLock`, `AvailabilitySlot` và các index/FK cần thiết đã có trong migration ban đầu.

## Bằng chứng 26/08/2026

- MySQL 8.4 Docker cổng `3307`: fresh `prisma migrate deploy` áp đủ 3 migration.
- Race test thật: concurrent open/block cùng Workspace/ngày đạt, đúng 4 slot và một trạng thái cuối đồng nhất.
- Live HTTP + DB smoke đạt: health → register → create Salon/Workspace → publish → open 2 slot → Discovery thấy 1 Workspace → block → đọc 2 slot `BLOCKED` → Discovery còn 0; dữ liệu smoke đã được dọn.
- API: 24 suite/55 test đạt; MySQL opt-in 1 suite/1 test đạt.
- Web: 2/2 test đạt; API/web typecheck và production build toàn monorepo đạt.

## Còn lại

D6-D8 đã được bàn giao tiếp theo trong `D6_D8_BOOKING_DELIVERY.md`: Professional profile guard, detail, hold/expiry, one-winner hold race, confirm atomically, timezone/local-date snapshot và UI booking. D3-D4 vẫn còn các race test MySQL riêng cho media cap/cleanup; không suy diễn kết quả race D5 thành bằng chứng cho các luồng đó.
