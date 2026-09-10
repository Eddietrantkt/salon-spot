# Cấu trúc source - Web, Database và Backend

## Quyết định hiện hành

Source được tổ chức như một pnpm monorepo. Yêu cầu hiện hành ưu tiên web mobile-first ở `apps/web`; không khởi tạo Flutter song song. Backend là NestJS modular monolith, database là MySQL 8.4/InnoDB qua Prisma.

```text
apps/
  web/                         # React/Vite: các hành trình người dùng
    src/app/                   # URL router, navigation and app composition
    src/shared/api/            # HTTP adapter duy nhất tới /api/v1
    src/features/discovery/    # query, page và UI components của Discovery
  api/                         # NestJS: rules và persistence
    src/common/                # config, health, Prisma adapter, worker foundation
    src/modules/discovery/     # Public search read module đã triển khai
    src/modules/auth/          # credentials/session đã triển khai
    src/modules/users/         # shared profile foundation
    src/modules/professionals/ # active Professional booking capability
    src/modules/salons/        # Owner membership + Salon supply đã triển khai
    src/modules/workspaces/    # authoring + publish checklist đã triển khai
    src/modules/availability/  # fixed slots, holds and expiry đã triển khai
    src/modules/bookings/      # confirm/snapshot/cancel/completion đã triển khai
    src/modules/payments/      # approval-dependent
    src/modules/media/         # signed PUT, verify/process/READY, cover/order/delete
    src/modules/chat/ admin/   # isolated future capabilities
    src/worker-main.ts         # worker process; Render POC có thể co-locate vào API
    prisma/                    # schema và migrations MySQL
packages/
  contracts/                   # versioned DTO, error, pagination; không chứa ORM model
```

## Seams và ownership

`apps/web` chỉ gọi interface HTTP versioned và quản lý trạng thái hiển thị. URL browser là nguồn sự thật cho Discover, Workspace detail, Bookings, Owner, Admin và login return path; reload, direct-link và browser-back không phụ thuộc React page state. Nó không tự xác nhận slot còn trống, giá hay quyền sở hữu.

`DiscoveryModule` lọc `PUBLISHED`/`OPEN`, pagination và chỉ map media `READY`. `MediaModule` sở hữu signed upload, lưu trữ local cho dev/UAT, decode/re-encode bằng `sharp`, hash/metadata, cover/order/delete và public content. Delete chỉ đổi DB sang `DELETE_PENDING` trong request; worker xử lý object rồi chuyển `DELETED`. `AvailabilityModule` sở hữu đọc/mở/block fixed slots, khóa `WorkspaceCalendarLock` theo Workspace/ngày và mọi chuyển trạng thái slot; Booking vẫn sở hữu lifecycle.

`ProfessionalsModule` là boundary duy nhất cho booking capability. `ProfessionalProfile(userId)` là 1:0..1 extension của `User`; chỉ profile `ACTIVE` được phép hold, confirm, đọc hoặc hủy Booking của chính mình. `SalonMembership(OWNER)` và `AdminAccess` độc lập, không cấp quyền booking. `Booking` snapshot `salonTimezone` và `localDate` cùng với UTC `startsAt`/`endsAt`; web luôn render history theo snapshot đó, không theo timezone máy người xem.

Worker jobs mặc định chạy trong `worker-main.ts` như một process riêng để có
readiness và restart boundary độc lập. Hosted Render POC đặt
`RUN_WORKERS_IN_API=true` để đăng ký cùng các job trong `main.ts`; đây là
workaround cho Render Free không có Background Worker miễn phí, không phải
topology production.

Professional trust được model riêng theo ba khái niệm: `ProfessionalVerificationCase` là một vòng submit/review; `ProfessionalCredential` là license/insurance có kỳ hạn; `ProfessionalDocument` là metadata bằng chứng riêng tư. File bytes không nằm trong MySQL và không dùng public listing media. `PasswordResetToken` thuộc `User` để mọi role dùng chung recovery. Đây là schema foundation additive; guard booking hiện chưa dựa vào verification để tránh khóa tài khoản cũ trước khi có onboarding/backfill.

Register intent `PROFESSIONAL` tạo profile `PENDING`; `GET/PATCH /professionals/me` cho phép chính user hoàn thiện thông tin cơ bản nhưng không được đặt status/verification. Trong local/UAT, operations cấp hoặc kích hoạt capability này qua `professional:grant`; thao tác upsert profile `ACTIVE` và ghi `AuditEvent`. Chưa có private-document hay approval/review endpoint, nên không được tự suy diễn quyền Professional từ email, Owner hay Admin.

## Database ownership

`schema.prisma` cùng `prisma/migrations` là nguồn sự thật. `AvailabilitySlot.localDate` là ngày theo timezone Salon, giúp discovery query chính xác mà không buộc client hay database phải suy diễn UTC. Composite FK `(rentalOptionId, workspaceId)` ngăn một slot tham chiếu RentalOption của Workspace khác.

## Thứ tự làm tiếp

1. Bổ sung race test MySQL còn thiếu cho media cap/cleanup và concurrent confirm/cancel.
2. Browser UAT cho refresh, direct URL, browser-back và mobile Owner/Admin navigation.
3. Hoàn thiện email provider theo scope được duyệt.
