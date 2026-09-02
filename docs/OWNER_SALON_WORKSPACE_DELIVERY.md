# Owner Salon & Workspace – Bàn giao

> Tài liệu này ghi lại lát bàn giao ngày 24/08. Trạng thái hiện hành đã được nối tiếp bởi D3-D4 media/publish trong `D3_D4_SUPPLY_MEDIA_DELIVERY.md`.

## Mục tiêu đã hoàn thành

Owner có thể tự tạo một **Salon** cùng **Workspace đầu tiên** và gói thuê cơ bản trong một thao tác. Sau đó Owner chỉ có thể xem và thêm Workspace thuộc các Salon mà chính họ sở hữu.

## So với trạng thái dự án trước thay đổi

| Trước đây | Đã bổ sung |
| --- | --- |
| Schema đã có `Salon`, `Workspace`, `RentalOption`, `SalonMembership` nhưng chưa có endpoint ghi dữ liệu Owner. | API tạo atomically Salon + `OWNER` membership + Workspace `DRAFT` + RentalOption. |
| Có `SalonMembershipAuthorizer` và `SalonOwnerGuard` nhưng chưa có route nào dùng chúng cho thao tác tạo Workspace. | `POST /owner/salons/:salonId/workspaces` áp JWT và `SalonOwnerGuard`; Owner khác Salon bị từ chối. |
| Web chỉ có màn hình Discovery công khai. | Thêm Owner Console với đăng ký/đăng nhập, tạo Salon + Workspace, liệt kê Salon sở hữu, thêm Workspace và đăng xuất phiên. |
| Chưa có audit cho thao tác tạo supply. | Ghi `SALON_CREATED` và `WORKSPACE_CREATED`, kèm `x-request-id` nếu client gửi. |

## Luồng nghiệp vụ hiện có

```text
Owner đăng ký/đăng nhập
  -> POST /owner/salons
  -> Salon + SalonMembership(OWNER) + Workspace(DRAFT) + RentalOption + AuditEvent
  -> GET /owner/salons
  -> POST /owner/salons/:salonId/workspaces (chỉ trong phạm vi Salon Owner sở hữu)
```

Workspace mới mặc định là `DRAFT`. D3-D4 hiện đã bổ sung media và checklist publish; AvailabilitySlot vẫn thuộc D5, nên Workspace đã publish chỉ xuất hiện trong Discovery sau khi có slot `OPEN`.

## API mới

| Method | Path | Mục đích |
| --- | --- | --- |
| `GET` | `/api/v1/owner/salons` | Lấy các Salon mà user có `SalonMembership(OWNER)`. |
| `POST` | `/api/v1/owner/salons` | Tạo Salon, membership Owner, Workspace đầu tiên và gói thuê trong một transaction. |
| `POST` | `/api/v1/owner/salons/:salonId/workspaces` | Thêm Workspace bản nháp vào một Salon đã được kiểm tra quyền Owner. |

Payload tạo Salon:

```json
{
  "name": "Luna Beauty House",
  "area": "D1",
  "timezone": "Asia/Ho_Chi_Minh",
  "workspace": {
    "name": "Ghế làm tóc 01",
    "rentalLabel": "2 giờ",
    "priceCents": 250000
  }
}
```

`priceCents` là tên trường có sẵn trong dự án; trong MVP hiện tại giá trị được hiển thị và nhập là VND để tương thích với Discovery hiện hữu.

## Thành phần đã thay đổi

- API Salon: `apps/api/src/modules/salons/application/owner-salons.service.ts`, controller và DTO đi kèm.
- API Workspace: `apps/api/src/modules/workspaces/application/owner-workspaces.service.ts`, controller và DTO đi kèm.
- Contract: `packages/contracts/src/index.ts`.
- Web Owner Console: `apps/web/src/features/owner/` và điều hướng tại `apps/web/src/app/app.tsx`.
- Kiểm thử đơn vị: Owner bootstrap và thêm Workspace, bổ sung vào bộ test API.

## Xác minh đã thực hiện

Ngày 2026-08-24:

- `pnpm --filter @salon-spot/contracts build` – đạt.
- `pnpm --filter @salon-spot/api typecheck` – đạt.
- `pnpm --filter @salon-spot/web typecheck` – đạt.
- `pnpm --filter @salon-spot/api test` – **13 suites, 25 tests đạt**.
- `pnpm --filter @salon-spot/web build` – đạt.
- Đã mở Owner Console cục bộ và xác nhận màn hình đăng ký Owner, điều hướng, nhãn form và nút hành động hiển thị đúng.

## Giới hạn còn lại

- Chưa đưa dữ liệu Salon/Workspace mẫu trực tiếp vào MySQL của máy này: chưa khởi động database/migration trong lượt bàn giao. Dữ liệu thật sẽ được tạo qua Owner Console hoặc API sau khi `.env`, MySQL và migration sẵn sàng.
- Media/publish/cleanup worker đã được bổ sung ở D3-D4; fixed-slot read/open/reopen/block đã được bổ sung ở D5; Professional hold/booking/lifecycle đã được bổ sung ở D6-D8. Trạng thái hiện hành nằm trong `BUILD_PLAN.md` và `docs/D6_D8_BOOKING_DELIVERY.md`.
- Owner Console khôi phục session sau reload qua refresh cookie `HttpOnly`; access token chỉ giữ trong memory và được refresh một lần khi request nhận 401. `Đăng xuất` revoke session cookie phía API.
