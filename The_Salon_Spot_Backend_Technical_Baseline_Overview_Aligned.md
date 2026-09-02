# THE SALON SPOT

## Backend Technical Baseline

> Thiết kế backend MVP đã điều chỉnh sau architectural review: module, dữ liệu, invariant, API và triển khai.

| Nhãn | Nội dung |
| --- | --- |
| Mục đích | Technical baseline lưu trữ để scaffold, review và kiểm thử backend Phase 1. |
| Kiến trúc | NestJS modular monolith, TypeScript, Prisma, PostgreSQL, REST. |
| Trạng thái | Baseline thiết kế; các quyết định thương mại còn mở được ghi rõ là giả định. |
| Phạm vi | MVP marketplace: Salon -> Workspace -> Availability -> Booking -> Payment. |

Nguyên tắc dẫn đường: giữ kiến trúc đơn giản cho MVP; siết tính đúng đắn ở ràng buộc dữ liệu, transaction, authorization và lifecycle thay vì thêm pattern hoặc hạ tầng không cần thiết.

# Overview dự án

The Salon Spot là marketplace PWA mobile-first kết nối Beauty Professional cần thuê chỗ làm với Owner/Manager vận hành Salon. Salon là ngữ cảnh doanh nghiệp/địa điểm; Workspace là đơn vị cung ứng có thể được đặt. Value loop Phase 1: Owner/Manager tạo Salon -> publish Workspace và Availability -> Professional tìm kiếm, chọn slot, thanh toán deposit -> hệ thống xác thực Availability/Payment -> instant booking confirmed.

## Nguyên tắc sản phẩm Phase 1

- Mobile-first PWA; native iOS/Android được hoãn.

- Workspace-first inventory: Salon không trực tiếp bookable.

- Instant booking: system availability và payment verified thay owner approval thủ công.

- Capacity = 1 là invariant Phase 1; multi-capacity/group booking chỉ mở cùng allocation design mới.

- Một identity có role additive; Owner/Manager scope theo SalonMembership, không phải role toàn cục.

- Chat hỗ trợ phối hợp nhưng không nằm trên booking/payment/cancellation critical path.

## Actors, domain và P0 journeys

| Actor | Mục tiêu chính | Quyền Phase 1 / điểm kiểm soát |
| --- | --- | --- |
| Guest | Khám phá nguồn cung trước khi tạo account. | Browse/search và xem Salon/Workspace public; không truy cập dữ liệu private. |
| Beauty Professional | Tìm và đặt Workspace. | Chọn Availability, tạo/quản lý Booking của mình, Chat, profile/license. |
| Owner/Manager | Tạo và vận hành nguồn cung. | Quản lý Salon/Workspace/Availability/Booking trong SalonMembership scope. |
| Admin | Giữ marketplace vận hành an toàn. | Inspect/recovery theo scope, reason và append-only audit; không bypass audit. |

- Role additive dùng chung một identity. Một người có thể là Professional khi thuê Workspace khác và Owner/Manager của Salon mình quản lý; shared account, profile, settings và messages không bị nhân đôi.

- Luồng domain: Salon -> Workspace -> AvailabilitySlot -> Booking -> Payment. Workspace capacity mặc định là 1; Chat chỉ hỗ trợ phối hợp, không phải điều kiện booking/payment/cancellation.

- P0-1: Owner publish supply. P0-2: Professional search -> chọn slot -> hold -> payment -> confirmed booking. P0-3: Professional cancel khi đủ điều kiện -> hệ thống cập nhật booking/slot và tạo refund record idempotent.

Payment Model B dùng một deposit cấu hình được (giả định khởi đầu 50%). Phase 1 chỉ hỗ trợ một charge/deposit và full refund; phần còn lại, partial refund, dispute và payout engine được hoãn.

# Sitemap đầy đủ theo vai trò

```text
THE SALON SPOT
|
|- PUBLIC
|  |- Home
|  |- Search -> Search Results
|  |- Salon Detail -> Workspace List
|  |- Workspace Detail
|  |  |- Photos / description / amenities
|  |  |- Pricing and rental options
|  |  `- Availability selection
|  `- Authentication -> Login / Register / Forgot Password
|
|- PROFESSIONAL
|  |- Dashboard / Explore
|  |- Search and Workspace Detail
|  |- Checkout / Payment -> Booking Confirmation
|  |- My Bookings -> Upcoming / Completed / Cancelled / Booking Detail
|  |- Messages -> Conversation
|  `- Profile -> Personal / Professional / License
|
|- OWNER / MANAGER
|  |- Dashboard
|  |- My Salons -> Salon List / Create / Detail / Location / Photos
|  |- Workspaces -> List / Create / Detail / Amenities / Pricing / Rental options
|  |- Availability -> Calendar / Available periods / Blocked periods
|  |- Bookings -> Booking Detail
|  |- Messages -> Conversation
|  `- Payout / Profile
|
|- ACCOUNT (shared) -> Profile / Role-mode switch / Settings / Logout
|
`- ADMIN
   |- Dashboard
   |- Users / Salons / Workspaces / Bookings
   `- Payments / Refunds / Exceptions
```

- UX decision: Workspace Detail là nơi hiển thị pricing, amenities và chọn Availability; Professional không cần một module Availability riêng để checkout. Sitemap là information architecture, không phải ánh xạ một-một tới backend modules.

- Owner có Availability Settings trong Workspace và Availability Calendar để vận hành nhiều Workspace; đây là một domain backend duy nhất.

- Sitemap mô tả màn hình/navigation. Backend module boundaries theo business ownership: Auth, Users/Professionals, Salons/Workspaces, Availability, Bookings, Payments, Chat và Admin - không ánh xạ một-một theo page.

# 1. Mục đích, phạm vi và các quyết định đã chốt

Tài liệu này là chuẩn kỹ thuật backend cho The Salon Spot Phase 1. Nó mô tả ranh giới module, mô hình dữ liệu, hợp đồng API, invariant, cách kiểm thử và thứ tự triển khai. Đây không phải tài liệu marketing, cũng không phải kế hoạch microservices.

## 1.1 Phạm vi MVP

- Marketplace PWA mobile-first cho Guest, Beauty Professional, Owner/Manager và Admin.

- Salon là ngữ cảnh doanh nghiệp/địa điểm; Workspace là đơn vị có thể được đặt.

- Instant booking: hệ thống xác thực Availability và Payment; không có bước owner phê duyệt thủ công.

- Workspace capacity = 1 là invariant Phase 1 tại database (CHECK hoặc bỏ field capacity). Một booking tiêu thụ đúng một predefined AvailabilitySlot; không mở capacity > 1 chỉ bằng đổi cấu hình.

- Payment Model B: deposit là cấu hình (giả định khởi đầu 50%, không hard-code).

- Messaging hỗ trợ phối hợp nhưng độc lập với checkout, booking, reschedule, cancellation và payment.

## 1.2 Không biến giả định thương mại thành invariant

- Tỷ lệ deposit, cutoff cancellation, cách thu phần còn lại, merchant-of-record và payout cadence là policy/configuration cần được chốt riêng.

- Refund Phase 1 có thể đơn giản là hoàn toàn bộ tiền đã thu khi đủ điều kiện; partial refund, tranh chấp và chargeback workflow được hoãn.

- Native iOS/Android, external calendar sync, Redis/Kafka/Elasticsearch/Kubernetes và microservices không cần cho MVP.

# 2. Function list MVP và ownership

Danh sách dưới đây là capability backend, không phải ánh xạ một-một từ màn hình frontend.

| Domain | Chức năng MVP | Owner / điểm kiểm soát |
| --- | --- | --- |
| Auth | Đăng ký, login, refresh/logout, quên/đặt lại mật khẩu, session revoke. | Auth module; token/session security. |
| Users & Professional | Profile, role additive, license metadata/document; membership theo Salon cho Owner/Manager. | Users/Professionals; SalonMembership là nguồn scope cho quyền quản lý supply. |
| Salons & Workspaces | Salon, Workspace, media, amenities, rental option, publish. | Salon/Workspace; owner/manager ownership check. |
| Availability | Tạo slot, block slot, đọc lịch, hold/checkout lease ngắn hạn, release expiry an toàn. | Availability; PostgreSQL constraint, lock order và checkout lease. |
| Bookings | Checkout intent idempotent, confirm từ webhook verified, cancel, history, reschedule request (nếu bật). | Bookings; PENDING_PAYMENT liên kết hold, lifecycle + immutable snapshots. |
| Payments | Checkout provider, webhook inbox, charge/deposit record, refund record/initiation. | Payments; raw-body signature, inbox dedupe, reconciliation và refund idempotent. |
| Chat | Conversation/message gắn ngữ cảnh salon/workspace/booking. | Chat; không có quyền đổi booking/payment. |
| Admin | Inspect, exception/recovery có audit trail. | Admin; quyền đặc biệt, không bỏ qua audit. |

# 3. Công nghệ và kiến trúc mục tiêu

## 3.1 Stack

- Runtime/API: Node.js, NestJS, TypeScript, REST/JSON.

- Data: PostgreSQL là database giao dịch; Prisma là ORM/schema client; SQL migration cho constraint PostgreSQL chuyên biệt.

- Validation: class-validator/class-transformer hoặc schema validator thống nhất tại DTO boundary; Prisma không thay thế validation business.

- Async nội bộ tối thiểu: worker-main.ts dùng chung codebase cho outbox, expiry và tác vụ provider. Không cần event bus phân tán.

- Storage: private object storage cho license; API chỉ phát signed URL ngắn hạn sau authorization.

- Test: unit + module/integration + PostgreSQL thật cho concurrency/constraint; e2e cho các hành trình P0.

## 3.2 Modular monolith

Một NestJS application là entry point API và một worker process tùy chọn dùng cùng modules/database. Mỗi module sở hữu business rules và persistence của mình; module khác gọi public application facade. packages/contracts chỉ được tách khi web/API thực sự cần contract dùng chung. Không thêm Repository Pattern per entity, CQRS, Event Sourcing hay microservices khi chưa có nhu cầu thực tế.

```text
HTTP Client
    -> NestJS Controllers / DTO boundary
    -> Application services (module facade)
    -> Domain rules + Prisma persistence
    -> PostgreSQL constraints / transactions

API process: apps/api/src/main.ts
Worker process: apps/api/src/worker-main.ts  (outbox, expiry, provider retries)
```

# 4. Source code structure

Cấu trúc dưới đây tối giản nhưng tạo đường biên rõ. Nếu repository chưa là monorepo, có thể bắt đầu với apps/api và chỉ tách packages khi web/contract dùng chung xuất hiện.

```text
the-salon-spot/
├─ apps/
│  ├─ api/
│  │  ├─ prisma/
│  │  │  ├─ schema.prisma
│  │  │  └─ migrations/
│  │  └─ src/
│  │     ├─ main.ts
│  │     ├─ worker-main.ts
│  │     ├─ common/                 # config, guards, filters, db, observability
│  │     └─ modules/
│  │        ├─ auth/
│  │        ├─ users/
│  │        ├─ professionals/
│  │        ├─ salons/
│  │        ├─ workspaces/
│  │        ├─ availability/
│  │        ├─ bookings/
│  │        ├─ payments/
│  │        ├─ chat/
│  │        └─ admin/
│  └─ web/                           # PWA client, không import Prisma
├─ packages/
│  ├─ contracts/                     # versioned DTO/schema/error/event contracts
│  ├─ i18n/
│  └─ test-kit/
├─ docs/adr/  docs/runbooks/  infra/
└─ .github/workflows/
```

## 4.1 Template bên trong một module

```text
modules/bookings/
├─ presentation/      # controller, request DTO, response mapper
├─ application/       # commands/queries, use cases, public facade
├─ domain/            # state transition rules, policy interfaces, types
├─ infrastructure/    # Prisma adapter, provider adapter, outbox adapter
├─ contracts/         # public module contract only when module khác cần gọi
└─ __tests__/         # unit + integration của module
```

- packages/contracts chỉ chứa contract versioned (DTO/schema/error/event). Không đặt Prisma model/client hay entity ORM dùng chung ở đây.

- Availability sở hữu slot, block, hold/checkout lease, allocation và thứ tự lock. Booking sở hữu lifecycle booking. Payment sở hữu provider inbox, checkout/refund record và webhook. SalonMembership sở hữu scope Owner/Manager theo Salon; generic role không tự cấp quyền lên mọi Salon.

- Controller không được điều phối transaction phức tạp; application service chịu trách nhiệm transaction boundary và gọi facade module khác.

# 5. Database source of truth và migration policy

Source of truth: apps/api/prisma/schema.prisma + apps/api/prisma/migrations/.

- schema.prisma mô tả Prisma models, relations, enum và các index Prisma hỗ trợ.

- Mỗi thay đổi schema được tạo thành migration có version trong Git; production chạy migration đã review, không dùng prisma db push.

- CHECK, EXCLUDE USING gist, partial unique index, extension và SQL trigger (nếu cần) phải nằm trong custom migration SQL. Prisma schema không đủ để là nguồn duy nhất cho các invariant PostgreSQL đó.

- CI khởi tạo PostgreSQL trống, chạy toàn bộ migration, rồi chạy test; điều này phát hiện migration drift sớm.

## 5.1 Quy ước thời gian

- Availability slot, hold expiry, Booking occurrence và payment event instant dùng TIMESTAMPTZ. API nhận ISO-8601 có offset/Z và lưu instant, không lưu local datetime mơ hồ.

- Workspace/Salon lưu IANA timezone (ví dụ Asia/Ho_Chi_Minh) để tạo và hiển thị lịch theo giờ địa phương.

- License expiry là DATE nếu business semantics là hết hạn theo ngày địa phương, không phải một instant UTC.

- Booking giữ snapshot start_at/end_at và timezone/display context tại thời điểm xác nhận để lịch sử không thay đổi khi slot/configuration bị chỉnh sửa sau này.

# 6. Database model: entities, PK/FK và relationships

| Entity | PK / FK chính | Vai trò và quan hệ |
| --- | --- | --- |
| User | PK id | Identity dùng chung; có nhiều role/session/profile/booking. |
| UserRole | PK id; FK user_id | Role additive: PROFESSIONAL, OWNER_MANAGER, ADMIN. Role toàn cục không thay thế scope Salon. |
| ProfessionalProfile | PK user_id -> User | Profile nghiệp vụ và license metadata. |
| LicenseDocument | PK id; FK professional_user_id | storage_key private, metadata/expiry DATE; không lưu public URL. |
| Salon | PK id; FK owner_user_id | Doanh nghiệp/địa điểm, chứa Workspace; owner cũng có SalonMembership phù hợp. |
| Workspace | PK id; FK salon_id | Đơn vị có thể đặt; giá/currency/configuration/timezone inherited or explicit. |
| AvailabilitySlot | PK id; FK workspace_id | Predefined interval; OPEN/HELD/BOOKED/BLOCKED; range không overlap, capacity = 1. |
| SlotHold | PK id; FK slot_id, user_id | Checkout lease ngắn hạn: ACTIVE/CONSUMED/EXPIRED/RELEASED; chỉ một ACTIVE hold/slot. |
| Booking | PK id; FK slot_id, hold_id, professional_user_id, workspace_id | Một checkout PENDING_PAYMENT liên kết một hold; snapshot immutable tại checkout, confirmed sau payment verified. |
| Payment / Refund | PK id; FK booking_id / payment_id | Charge/deposit và full-refund record riêng có provider reference, status, amount, idempotency key. |
| AuthSession | PK id; FK user_id | Refresh token hash, rotation/revoke/expiry/device metadata. |
| PasswordResetToken | PK id; FK user_id | One-time token hash, expiry, used_at/revoked_at. |
| Conversation / Message | FK participants/context | Chat context; không điều khiển lifecycle booking. |
| OutboxEvent / ProviderInbox | PK id | Reliable side effects và webhook dedupe/audit. |
| SalonMembership | PK (salon_id, user_id); FK Salon/User | OWNER hoặc MANAGER, trạng thái và scope authorization theo Salon. |
| AuditEvent | PK id; FK actor_user_id? | Append-only audit cho admin recovery, cancellation, refund, license access và security event. |

## 6.1 Relationship chuẩn

User 1---* UserRole / AuthSession / PasswordResetToken
User 1---* SalonMembership *---1 Salon
User 1---0..1 ProfessionalProfile 1---* LicenseDocument
Salon 1---* Workspace 1---* AvailabilitySlot
AvailabilitySlot 1---* SlotHold (lịch sử); Booking 1---1 SlotHold cho checkout PENDING_PAYMENT
AvailabilitySlot 1---* Booking (lịch sử; tối đa một PENDING_PAYMENT hoặc CONFIRMED chiếm inventory)
Booking *---1 Professional(User), *---1 Workspace, 1---* Payment, Payment 1---* Refund
AuditEvent ghi nhận action nhạy cảm, độc lập với application logs.

Booking giữ cả slot_id và workspace_id để query lịch sử; database phải bảo đảm hai giá trị cùng Workspace. Dùng UNIQUE(id, workspace_id) trên AvailabilitySlot và composite FK bookings(slot_id, workspace_id), thay vì chỉ dựa vào service. Áp dụng cùng nguyên tắc cho rental_option_id/workspace_id của slot.

## 6.2 Quy ước physical schema

- PK dùng UUID (hoặc một chiến lược ID thống nhất khác); mọi FK dùng đúng kiểu với PK và có index khi là đường truy vấn phổ biến. Không trộn UUID/string ID tùy tiện.

- Nếu dùng email CITEXT, migration phải bật CREATE EXTENSION IF NOT EXISTS citext; extension, enum và index custom luôn thuộc prisma/migrations, không chỉ schema.prisma.

- created_at, updated_at, expires_at, occurred_at, starts_at, ends_at dùng TIMESTAMPTZ; chỉ license expiry dùng DATE. Những bảng lịch sử Booking/Payment/Audit không hard-delete.

- Tiền dùng NUMERIC(12,2) (hoặc precision được chốt toàn hệ thống) và currency CHAR(3) ISO-4217. Không dùng float/double cho money.

- Status dùng PostgreSQL enum hoặc VARCHAR có CHECK được version-control qua migration. Giá trị state phải thống nhất với application state machine.

- Các ID/fk/price/time ở Booking chỉ do server ghi. Client không được gửi giá, workspace_id hoặc interval để server tin trực tiếp.

## 6.3 Catalog bảng nghiệp vụ - cột quan trọng

Đây là mức cột tối thiểu để triển khai. Trường trình bày trong ngoặc là kiểu PostgreSQL gợi ý; Prisma model dùng mapping tương đương.

| Bảng | Cột chính | FK / index và ghi chú |
| --- | --- | --- |
| users | id UUID PK; email CITEXT; password_hash; display_name; status; created_at | UNIQUE(email). Không lưu refresh/reset token raw. |
| user_roles | id UUID PK; user_id UUID; role; created_at | FK -> users; UNIQUE(user_id, role). Role additive. |
| professional_profiles | user_id UUID PK; license_number?; bio?; updated_at | PK/FK -> users. Các field nghiệp vụ chỉ thêm khi product cần. |
| license_documents | id UUID PK; professional_user_id; storage_key; content_type; byte_size; checksum; expiry_date DATE | FK -> professional_profiles/users; INDEX(professional_user_id). storage_key private, không public URL. |
| salons | id UUID PK; owner_user_id; name; address fields; timezone; status; created_at | FK -> users; INDEX(owner_user_id). Salon không trực tiếp bookable. |
| workspaces | id UUID PK; salon_id; name; description; capacity; status; created_at | FK -> salons; INDEX(salon_id, status); CHECK(capacity = 1) ở Phase 1 hoặc không expose capacity. |
| workspace_images | id UUID PK; workspace_id; storage_key; sort_order; content_type; created_at | FK -> workspaces; UNIQUE(workspace_id, sort_order). Public read chỉ phát CDN/signed URL theo policy. |
| workspace amenities | MVP: amenity_codes TEXT[] hoặc enum[] trên workspaces; metadata cần thiết mới tách amenity/workspace_amenities. | GIN index khi cần filter theo amenity. Entity/table không đồng nghĩa cần module riêng. |
| workspace_rental_options | id UUID PK; workspace_id; code; label; duration_minutes; price_amount NUMERIC; currency CHAR(3); active | FK -> workspaces; UNIQUE(workspace_id, code). Là price source trước khi snapshot booking. |
| availability_slots | id UUID PK; workspace_id; rental_option_id; starts_at; ends_at; status; version; created_at | FK cùng workspace; UNIQUE(id, workspace_id); CHECK time + EXCLUDE. Đây là authoritative availability ledger. |

| Bảng | Cột chính | FK / index và ghi chú |
| --- | --- | --- |
| slot_holds | id UUID PK; slot_id; user_id; status; expires_at; idempotency_key; created_at | FK -> availability_slots/users; UNIQUE idempotency key; partial unique một ACTIVE hold/slot. PENDING booking tham chiếu hold này. |
| bookings | id UUID PK; hold_id UNIQUE; slot_id; workspace_id; professional_user_id; status; checkout_expires_at; total_price; deposit_due; currency; starts_at; ends_at; timezone; confirmed_at; cancelled_at | Composite FK slot/workspace; server-populated immutable snapshot tại checkout; partial unique cho PENDING_PAYMENT/CONFIRMED occupancy. |
| payments | id UUID PK; booking_id; provider; provider_payment_id; amount; currency; status; paid_at | Charge/deposit record. UNIQUE(provider, provider_payment_id) khi provider có reference ổn định; không gộp refund vào cột refunded_at. |
| auth_sessions | id UUID PK; user_id; refresh_token_hash; family_id; expires_at; revoked_at; replaced_by_id | FK -> users/self; INDEX(user_id, revoked_at). Hỗ trợ rotation/revoke. |
| password_reset_tokens | id UUID PK; user_id; token_hash; expires_at; used_at; created_at | FK -> users; UNIQUE token_hash; token single-use, không lưu raw. |
| provider_inbox | id UUID PK; provider; provider_event_id; payload_ref; received_at; processed_at; status | UNIQUE(provider, provider_event_id). Webhook dedupe/audit. |
| outbox_events | id UUID PK; aggregate_type; aggregate_id; event_type; payload; occurred_at; published_at | INDEX(published_at, occurred_at). Side effect chỉ publish sau DB commit. |
| refunds | id UUID PK; payment_id; provider_ref; amount; status; idempotency_key; requested_at; completed_at | FK -> payments; UNIQUE provider_ref và idempotency key. Phase 1 full refund only. |
| audit_events | id UUID PK; actor_user_id?; action; entity_type; entity_id; reason; request_id; metadata; occurred_at | Append-only; metadata redact; index entity và occurred_at. |

## 6.4 FK action, indexes và constraint matrix

| Mục tiêu | Cơ chế database | Ý nghĩa |
| --- | --- | --- |
| Không xóa lịch sử | FK RESTRICT/NO ACTION từ bookings/payments/audit; soft-disable identity/supply khi cần. | Không để xóa User/Workspace làm mất booking/payment history. |
| Một option đúng workspace | FK workspace_rental_options.workspace_id; application verifies slot.rental_option.workspace_id = slot.workspace_id. | Tránh slot của Workspace A dùng giá của Workspace B. |
| Không overlap inventory | CHECK starts_at < ends_at + EXCLUDE USING gist(workspace_id, tstzrange(...)). | Đảm bảo capacity-one slot/block không giao nhau. |
| Một active hold | Partial UNIQUE INDEX slot_holds(slot_id) WHERE status = 'ACTIVE'. | Retry hoặc 2 client không thể giữ cùng slot. |
| Một checkout đang sống hoặc confirmed booking | Partial UNIQUE INDEX bookings(slot_id) WHERE status IN ('PENDING_PAYMENT', 'CONFIRMED') | Lớp bảo vệ cuối cùng khi checkout/webhook/expiry race; PENDING phải gắn với active hold và expiry. |
| Webhook exactly-once effect | UNIQUE(provider, provider_event_id) trên provider_inbox. | Provider retry không confirm/refund hai lần. |
| Truy vấn vận hành | Index bookings(professional_user_id, starts_at), bookings(workspace_id, starts_at), availability_slots(workspace_id, starts_at). | Phục vụ My Bookings, owner calendar và discovery theo thời gian. |
| Scope Owner/Manager | UNIQUE salon_memberships(salon_id, user_id) + authorization query theo membership | Không để role OWNER_MANAGER toàn cục bypass Salon scope. |
| Cross-workspace integrity | Composite FK booking(slot_id, workspace_id) và slot(rental_option_id, workspace_id) | Ngăn booking/price option lệch Workspace ngay tại database. |
| Checkout occupancy | UNIQUE(hold_id) + partial unique bookings(slot_id) WHERE status IN ('PENDING_PAYMENT','CONFIRMED') | Một checkout đang sống hoặc booking confirmed cùng chiếm một slot. |

Lưu ý quan trọng: CHECK không thể kiểm tra FK cross-table. Không để invariant workspace chỉ nằm ở application service: dùng composite UNIQUE/FK cho Booking và AvailabilitySlot/RentalOption. Trigger chỉ là phương án cuối cùng nếu một invariant không thể biểu diễn bằng FK/index.

## 6.5 Data flow ghi dữ liệu - authoritative path

1. Owner publish: Salon -> SalonMembership -> Workspace(capacity = 1) -> RentalOption -> AvailabilitySlot(OPEN/BLOCKED).
2. Professional hold: conditional UPDATE slot OPEN -> HELD + INSERT SlotHold(ACTIVE, holder, expires_at, idempotency_key) trong transaction.
3. Checkout: client gửi hold id + Idempotency-Key; service lock hold/slot, kiểm tra holder và expiry, tạo Booking(PENDING_PAYMENT, hold_id UNIQUE, immutable snapshot, checkout_expires_at) rồi tạo provider checkout bằng provider idempotency reference.
4. Verified webhook: ghi ProviderInbox dedupe, worker lock booking/hold/slot, kiểm tra provider success và checkout chưa bị expiry/released; Payment SUCCEEDED -> SlotHold CONSUMED -> Booking CONFIRMED -> slot BOOKED.
5. Expiry/failed checkout: worker lock cùng aggregate, chỉ khi chưa có payment verified mới Booking EXPIRED + SlotHold EXPIRED/RELEASED + HELD slot OPEN. Payment thành công đến muộn đi vào refund/reconciliation, không cố confirm slot đã được giải phóng.
6. Cancel: lock booking/slot -> Booking CANCELLED; chỉ release BOOKED -> OPEN nếu occurrence ở tương lai và policy cho phép; tạo Refund record/outbox idempotent.
7. Worker dùng lease/retry để xử lý outbox, expiry và provider retry; side effect chỉ publish sau DB commit.

- AvailabilitySlot là source of truth cho inventory hiện tại; Booking/Payment là source of truth cho lịch sử giao dịch. Không suy diễn availability hiện tại chỉ bằng query Booking.

- Workspace current name/price/rental option không ghi đè Booking snapshot. Khi cần report hiện tại, join Workspace; khi hiển thị lịch sử, ưu tiên snapshot Booking.

- Mọi write flow nêu trên chạy qua application service transaction. Provider call không phải DB transaction: dùng provider idempotency reference, persist attempt/reference và có reconciliation để recover crash giữa provider call và DB write. Controller, Chat và frontend không được sửa status trực tiếp.

# 7. Database invariants và SQL migration bắt buộc

## 7.1 Interval hợp lệ và không overlap

Mọi slot phải thỏa starts_at < ends_at. Với workspace capacity = 1, PostgreSQL là lớp bảo vệ cuối cùng chống slot configuration/blocked period chồng lấn. Ứng dụng vẫn validate sớm để trả lỗi dễ hiểu, nhưng không thay thế database constraint.

```text
-- custom migration SQL (minh họa)
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE availability_slots
  ADD CONSTRAINT availability_slot_time_valid
  CHECK (starts_at < ends_at);

ALTER TABLE availability_slots
  ADD CONSTRAINT availability_slot_no_overlap
  EXCLUDE USING gist (
    workspace_id WITH =,
    tstzrange(starts_at, ends_at, '[)') WITH &&
  )
  WHERE (status IN ('OPEN', 'HELD', 'BOOKED', 'BLOCKED'));

CREATE INDEX availability_slots_workspace_range_gist
  ON availability_slots USING gist
  (workspace_id, tstzrange(starts_at, ends_at, '[)'));
```

Ghi chú: chỉ đưa những trạng thái thực sự chiếm inventory vào predicate. Nếu tách block thành bảng khác, exclusion constraint phải bao phủ cả hai qua cùng một ledger/table hoặc transaction design tương đương; đừng để availability và blocked period nằm ở hai bảng không thể bảo vệ lẫn nhau.

## 7.2 Tối đa một checkout đang sống hoặc booking CONFIRMED cho một slot

CREATE UNIQUE INDEX booking_one_live_or_confirmed_per_slot
  ON bookings (slot_id)
  WHERE status IN ('PENDING_PAYMENT', 'CONFIRMED');

- Partial unique index là lớp cuối cùng chống double checkout, double-confirm và race expiry/webhook. PENDING_PAYMENT chỉ hợp lệ khi hold linked còn ACTIVE và chưa expiry.

- Booking có thể có record lịch sử CANCELLED/EXPIRED; index chỉ cấm hơn một PENDING_PAYMENT hoặc CONFIRMED cùng chiếm slot.

- Nếu product có trạng thái active khác cũng chiếm slot, predicate phải được mở rộng có chủ đích, gắn rule release/expiry và test lại concurrency.

## 7.3 One booking = one predefined slot

- Booking không nhận arbitrary start/end từ client. Client chọn availability_slot_id; service truy vấn slot và tạo booking từ thời gian của slot.

- Booking snapshot total_price, deposit_due, currency, starts_at, ends_at, workspace_name/salon name khi confirmation. Giá/configuration mới không rewrite history.

- AvailabilitySlot đã BOOKED không được sửa start_at, end_at hoặc workspace_id. UI/API trả 409 Conflict cho mọi attempt; database trigger chỉ thêm khi application rule không đủ coverage hoặc có admin SQL path.

## 7.4 Conditional transition

```text
UPDATE availability_slots
SET status = 'HELD', version = version + 1
WHERE id = $slot_id
  AND status = 'OPEN'
  AND starts_at > now();

-- Số row affected = 1 mới được tạo hold/checkout.
-- 0 row: slot đã bị chiếm, không tồn tại hoặc state không hợp lệ -> 409/404 phù hợp.
```

- Mọi transition kiểm tra current state trong WHERE hoặc dưới SELECT ... FOR UPDATE; không read rồi write không điều kiện.

- Khóa thứ tự nhất quán: slot trước, rồi booking/payment liên quan. Không đảo order giữa code paths để tránh deadlock.

- Optimistic version có thể dùng cho owner edit; availability allocation vẫn dựa vào DB transaction/constraint.

# 8. Booking, cancellation và lịch sử

## 8.1 State model tối thiểu

AvailabilitySlot: OPEN -> HELD -> BOOKED
                  |       |         |
                  v       v         v
               BLOCKED   OPEN      OPEN (chỉ cancellation đủ điều kiện, occurrence tương lai)
                        (hold expiry / payment failed)

SlotHold: ACTIVE -> CONSUMED | EXPIRED | RELEASED
Booking: PENDING_PAYMENT -> CONFIRMED -> COMPLETED
             |                  |
             v                  v
          EXPIRED           CANCELLED
Payment: PENDING -> SUCCEEDED | FAILED; Refund là record/lifecycle riêng.

Tên enum có thể điều chỉnh, nhưng ownership, checkout expiry và transition rules không được mơ hồ. Payment success đã verify là gate để Booking đi CONFIRMED; payment success đến sau expiry/release là nhánh refund/reconciliation. Chat không có transition nào trong sơ đồ này.

## 8.2 Cancellation transactional và idempotent

1. Authorize actor (professional chủ booking, owner/manager có SalonMembership cho workspace hoặc admin theo policy) và load booking/slot trong transaction.

2. Kiểm tra booking đang CONFIRMED và policy cancellation. Nếu đã CANCELLED: trả kết quả hiện hữu với cùng idempotency key, không phát lệnh refund lần hai.

3. Conditional update Booking sang CANCELLED; chỉ release slot BOOKED sang OPEN khi starts_at còn ở tương lai và policy cho phép; ghi cancellation metadata/audit/outbox trong cùng transaction.

4. Tạo refund intent/record idempotent trong transaction; worker/provider xử lý side effect sau commit. Không gọi provider rồi mới sửa DB.

5. Trả response nhất quán. Webhook refund sau đó cập nhật Payment/refund status idempotently.

Idempotency phải dựa vào key do client gửi hoặc business key có uniqueness, không dựa vào việc client 'không bấm lại'. DB records và outbox là nguồn phục hồi sau retry/crash.

## 8.3 Historical data

- Không derive history từ Workspace current price/name/slot sau khi booking confirmed.

- Lưu price snapshot với numeric precision (ví dụ DECIMAL), currency ISO-4217, deposit snapshot, selected rental option, start/end TIMESTAMPTZ, timezone label và participant display snapshot cần thiết.

- Không xóa cứng Booking/Payment/Refund/Audit khi người dùng xóa profile. Dùng lifecycle/anonymization policy phù hợp privacy và retention.

## 8.4 Payment, expiry và reconciliation

- Provider checkout phải có expiry đồng bộ với checkout lease và idempotency reference ổn định. Worker không được giải phóng hold chỉ vì timer nếu ProviderInbox đã nhận payment success cần xử lý; dùng lock, một grace/reconciliation rule được document và test race có chủ đích.

- Payment/refund là immutable records có status; không dùng một timestamp refunded_at để đại diện toàn bộ lịch sử. Phase 1 chỉ khởi tạo full refund một lần cho charge/deposit đã thành công.

- Webhook signature dùng raw request body, event id dedupe và payload/metadata được bảo vệ. Provider callback không phải bằng chứng duy nhất khi crash: có reconciliation theo provider reference và runbook xử lý late payment.

# 9. Auth và security baseline

## 9.1 Access token và refresh session

- Access token ngắn hạn; refresh token opaque/random hoặc JWT có jti nhưng luôn được kiểm tra bằng AuthSession server-side.

- Chỉ lưu refresh_token_hash (Argon2/bcrypt hoặc HMAC secret phù hợp), không lưu refresh token nguyên văn.

- Rotation: refresh thành công tạo token/session version mới và revoke token/session cũ; reuse token đã revoke là security signal, có thể revoke toàn session family.

- Logout, password reset, account disable và admin revoke phải vô hiệu session đúng phạm vi. Cookie refresh cần HttpOnly, Secure, SameSite phù hợp; CSRF strategy phải phù hợp nếu dùng cookie cross-site.

## 9.2 Password reset

- Tạo token ngẫu nhiên, single-use, ngắn hạn; chỉ lưu token hash. Không log token, không đưa token vào analytics.

- Response forgot-password không tiết lộ email có tồn tại hay không. Rate-limit endpoints và audit attempt bất thường.

- Reset hợp lệ set used_at/revoked_at, đổi password hash, revoke refresh sessions và phát audit/outbox notification trong transaction hợp lý.

## 9.3 Private license document

- LicenseDocument lưu storage_key, content_type, byte_size, checksum, uploaded_at, expiry_date; không lưu URL public bền vững.

- Upload/download qua signed URL ngắn hạn chỉ sau authorization (chủ hồ sơ hoặc Admin có scope). Sau upload, server xác minh object tồn tại, byte size, content type và checksum trước khi document usable; scan file khi hạ tầng hỗ trợ.

- Không trả storage_key nội bộ hay signed URL trong list public; redact data nhạy cảm khỏi log/error response.

# 10. REST API boundaries, DTO và authorization

## 10.1 Ranh giới REST gợi ý

| Nhóm | Endpoint mẫu | Quy tắc |
| --- | --- | --- |
| Auth | POST /auth/login, /refresh, /logout, /password-reset/* | Không leak account; rotation/revoke server-side. |
| Discovery | GET /workspaces, /workspaces/:id, /availability | Public/read chỉ trả dữ liệu publishable. |
| Owner supply | POST/PATCH /salons, /workspaces, /availability-slots | Owner/manager ownership + booked-slot immutability. |
| Checkout | POST /availability-slots/:id/holds; POST /bookings/checkout | Conditional hold; Idempotency-Key + payload fingerprint; checkout chỉ dùng hold của actor, không nhận arbitrary interval. |
| Bookings | GET /bookings/:id; POST /bookings/:id/cancel | BOLA check + transactional lifecycle. |
| Payments | POST /payments/provider-webhooks; GET /payments/:id | Raw-body signature, provider inbox dedupe, asynchronous processing/reconciliation; không expose provider secret. |
| License | POST /licenses/upload-url; GET /licenses/:id/download-url | Signed URL chỉ sau authorization. |
| Admin | GET /admin/*; POST /admin/*/recovery | Role/scope, reason, audit trail. |

## 10.2 DTO và business validation

- DTO validate shape/type/size/enum/ISO date format ngay ở controller boundary. Reject unknown fields nếu contract cần chặt.

- Application service validate existence, ownership, state transition, policy, price/currency source, timezone semantics và cross-entity consistency.

- Không tin workspace_id/price/status do client gửi trong checkout. Lấy chúng từ availability slot, Workspace và policy server-side.

- Prisma types bảo vệ compile-time; chúng không thay thế validation request, authorization hay SQL constraints. Chọn một validation style thống nhất cho DTO boundary, không duy trì hai phong cách song song.

- Các write retryable dùng Idempotency-Key chuẩn hóa. Persist key, actor, route, request fingerprint và response reference; cùng key nhưng payload khác phải trả lỗi contract rõ ràng.

## 10.3 Authorization, ownership và BOLA

- Mỗi endpoint object-level kiểm tra actor được quyền trên object cụ thể, không chỉ kiểm tra role. Đây là bảo vệ Broken Object Level Authorization (BOLA/IDOR).

- Professional chỉ đọc/cancel booking của mình. Owner/Manager chỉ thao tác Salon/Workspace thuộc phạm vi quản lý và đọc booking liên quan. Admin chỉ qua guard/scope rõ ràng và audit action.

- Conversation/message cũng kiểm tra participant. Không để booking_id hoặc workspace_id client truyền trở thành bypass ownership.

# 11. Error format, logging và configuration

## 11.1 Error response thống nhất

```text
{
  "error": {
    "code": "SLOT_NOT_AVAILABLE",
    "message": "The selected slot is no longer available.",
    "details": [{"field": "availabilitySlotId", "reason": "conflict"}],
    "requestId": "req_..."
  }
}
```

- Map validation -> 400/422, unauthenticated -> 401, authorization/BOLA -> 403, missing public resource -> 404, state/unique/constraint conflict -> 409, idempotency payload mismatch -> 422 hoặc 409 theo contract.

- Không expose SQL, stack trace, storage_key, provider secret, token hoặc internal policy detail trong response.

- Error code là stable contract; message có thể i18n. Mọi response có requestId/correlationId để truy vết.

## 11.2 Logging & audit

- Structured log: timestamp, level, requestId, actorId (nếu có), module, action, entity IDs, result, latency. Không log password/token/signed URL/license content/PII không cần thiết.

- AuditEvent append-only cho admin override/recovery, ownership-sensitive edit, booking cancellation, refund request, license access và session security event. Ghi actor, action, target, reason, requestId và metadata đã redact; log vận hành không thay thế audit.

- Log error phải giữ provider reference/status an toàn để retry và reconciliation; webhook raw payload được bảo vệ/restricted và có retention policy. Worker/outbox ghi attempt_count, next_attempt_at, locked_until và last_error; theo dõi backlog, expiry lag và webhook failure.

## 11.3 Environment config

```text
DATABASE_URL=postgresql://...
JWT_ACCESS_SECRET=...
REFRESH_TOKEN_PEPPER=...
PASSWORD_RESET_PEPPER=...
APP_BASE_URL=https://...
OBJECT_STORAGE_BUCKET=...
OBJECT_STORAGE_REGION=...
PAYMENT_PROVIDER_SECRET=...
PAYMENT_WEBHOOK_SECRET=...
LOG_LEVEL=info
```

- Config module validate required values and environment-specific constraints at startup; fail fast for missing secret/URL.

- Secrets come from secret manager/CI environment, never source control. Separate local/test/staging/production databases and provider keys.

- Feature/configurable policies (deposit rate, hold TTL, checkout grace, cancellation cutoff) dùng typed config hoặc database policy với audited change path; không magic constants. Runbook deploy phải nêu migration order, worker rollout, backup/restore và provider reconciliation.

# 12. Testing strategy và acceptance checks

| Lớp | Mục tiêu | Ví dụ bắt buộc |
| --- | --- | --- |
| Unit | Rule thuần, nhanh, không DB. | State transition; cancellation eligibility; price snapshot calculation. |
| Module integration | Prisma + Postgres test DB. | DTO -> service -> persistence; ownership; error mapping. |
| Concurrency (PostgreSQL thật) | Chứng minh invariant dưới race. | Hai transaction cùng hold/confirm một slot; expiry worker và webhook success race: đúng một outcome hợp lệ, late payment được refund/reconcile. |
| E2E | P0 API journey end-to-end. | Owner publish -> membership-scoped hold -> checkout -> verified webhook -> confirmed -> eligible cancel/refund record. |
| Migration | Schema deployable/reproducible. | Fresh DB runs all migrations; EXCLUDE/CHECK/partial index tồn tại. |
| Security | Không bypass access control. | BOLA cross-user và cross-Salon membership; refresh reuse; reset token single-use; signed upload completion verification. |

## 12.1 Concurrency tests phải dùng PostgreSQL thật

- Không dùng SQLite/in-memory mock để chứng minh exclusion constraint, partial unique index, row lock hay transaction isolation PostgreSQL.

- Dùng test database tách biệt; chạy migration thật trước test. Khởi tạo hai client/transaction song song với barrier để tạo race có chủ đích.

- Assert chính xác: một kết quả success; một kết quả conflict/domain error; sau cùng chỉ có một CONFIRMED booking và slot state nhất quán.

- Bao phủ race create slot overlap, double hold, double payment/webhook confirm, expiry worker chạy trùng, payment success đến sát/qua checkout expiry, cancellation retry và provider call retry/crash recovery.

## 12.2 Quality gates

- Format/lint, explicit TypeScript type-check, unit/integration/e2e phù hợp, Prisma migration status và build chạy riêng. Vite/Nest build không mặc định chứng minh type-check nếu cấu hình không làm điều đó.

- API contract tests giữ error codes/DTO stable. Database migration test là gate trước deploy.

- Manual smoke test sau deploy: signed license URL + upload completion verification, timezone display, checkout conflict, webhook raw-signature reject, cancellation idempotency, outbox retry và late-payment reconciliation.

# 13. Thứ tự triển khai đề xuất

1. Freeze domain terms, enum/state transition, SalonMembership scope, checkout expiry/late-payment policy, timezone policy, Payment Model B open assumptions và API error contract; ghi ADR cho quyết định không hiển nhiên.

2. Scaffold NestJS modules/common config, PostgreSQL/Prisma, migration workflow, requestId/logging/error filter và auth guard foundation.

3. Thiết kế schema.prisma + custom migrations: core identity/salon/membership/workspace, AvailabilitySlot CHECK/EXCLUDE/composite FK, Booking hold link + partial unique index, payment/refund, session/reset/license/audit metadata.

4. Implement Auth/User/Professional + SalonMembership ownership guards; test refresh rotation, reset token, BOLA cross-Salon và private license signed URL/upload completion.

5. Implement Salon/Workspace publish/read/discovery với DTO/business validation.

6. Implement Availability create/block/read/hold/expiry với transaction and PostgreSQL concurrency tests trước checkout UI integration.

7. Implement Booking checkout/confirmation/cancellation với hold link, immutable snapshot, expiry, idempotency và PostgreSQL concurrency test; sau đó Payment provider inbox/raw webhook/refund record, reconciliation và outbox worker.

8. Implement Chat/Admin as isolated capabilities; add audit/runbooks/monitoring; execute E2E P0 and deploy smoke checks.

# 14. Coding guidelines

- Name business concepts consistently: Salon, Workspace, AvailabilitySlot, Booking, Payment, AuthSession. Không tạo entity/module mới chỉ vì một screen hoặc bảng phụ.

- Một method/use case có một trách nhiệm business rõ: holdSlot, confirmPayment, cancelBooking. Controller mỏng; transaction logic tập trung ở application service.

- Dùng typed DTO, explicit return types nơi boundary quan trọng, enum/state type thay string tự do; tránh any/implicit cast qua business boundary.

- Không truy cập Prisma model của module khác trực tiếp để write. Cross-module read chỉ qua facade/query contract đã được phép rõ ràng; không tạo shared ORM models trong packages/contracts.

- Không swallow lỗi database/provider. Map lỗi đã biết thành domain error, log an toàn, preserve cause cho observability.

- Mọi side effect retryable cần idempotency key/inbox/outbox hoặc business unique key rõ ràng.

- Comment lý do khi dùng lock, isolation hoặc custom SQL constraint; code phải giải thích invariant mà nó bảo vệ.

# 15. Deferred / không cần cho MVP

- Microservices, distributed event bus, CQRS/Event Sourcing, Redis Pub/Sub, Kafka, Elasticsearch và Kubernetes.

- Repository per Prisma entity hoặc Clean Architecture hình thức làm tăng lớp bọc mà không tăng safety cho scope này.

- External Google/Apple Calendar sync, native mobile apps, recommendation engine/advanced analytics.

- Multi-capacity inventory/group booking; nếu mở capacity > 1 cần thiết kế lại allocation ledger và invariants, không chỉ nới một field.

- Automated license verification, complex payout engine, partial-refund/dispute/chargeback workflow, advanced notification center.

# 16. Checklist baseline trước khi code feature booking

- [ ] schema.prisma và migration được commit cùng nhau; custom PostgreSQL constraints đã có migration test.

- [ ] AvailabilitySlot có CHECK starts_at < ends_at, CHECK/constraint capacity = 1, exclusion constraint đúng predicate occupancy và composite FK với RentalOption/Workspace.

- [ ] SlotHold/Booking có link unique, checkout expiry và partial unique index bảo đảm chỉ một PENDING_PAYMENT hoặc CONFIRMED chiếm slot; webhook/expiry races có test PostgreSQL thật.

- [ ] Booking chỉ nhận predefined slot/hold của actor; snapshots price/currency/time được tạo tại checkout và không thay đổi sau confirmation.

- [ ] Booked slot immutable về workspace/start/end; mọi state transition conditional và được audit/log.

- [ ] Cancellation/retry/refund record transactionally idempotent; release chỉ cho future occurrence; late-payment refund/reconciliation, outbox/webhook inbox đã có.

- [ ] Refresh/reset/license/BOLA/error/logging/config tests qua acceptance checks; SalonMembership và AuditEvent bảo vệ quyền Owner/Manager/Admin theo object scope.

- [ ] Webhook raw-body signature, provider inbox dedupe, worker lease/retry metrics và deployment/reconciliation runbook đã được kiểm thử.

Kết luận: kiến trúc modular monolith giữ nguyên là lựa chọn phù hợp. Độ tin cậy của MVP phụ thuộc chủ yếu vào migration thực, invariant PostgreSQL, transaction lifecycle, authorization cấp đối tượng và test concurrency - không phụ thuộc vào việc thêm nhiều layer hoặc dịch vụ.
