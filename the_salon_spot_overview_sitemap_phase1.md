# The Salon Spot - Product Overview & Sitemap

**Phase:** 1 baseline  
**Document purpose:** Shared product, UX information-architecture, and implementation-reference baseline  
**Status:** Finalized for Phase 1 planning

---

## 1. Product/System Overview

The Salon Spot is a mobile-first PWA marketplace that connects Beauty Professionals who need a place to work with Salon Owners/Managers who offer bookable workspaces.

The Phase 1 value loop is deliberately simple:

```text
Owner/Manager creates a Salon
        -> creates and publishes Workspaces
        -> configures price and system availability

Beauty Professional searches
        -> selects an available Workspace and time
        -> creates an instant booking
        -> receives booking confirmation
```

The product is not a salon directory alone. It is a marketplace for booking a specific **Workspace** at a salon. A Salon provides the business and location context; a Workspace is the resource that can be booked.

### Phase 1 product principles

- **Mobile-first PWA.** The primary experience is optimized for mobile web; native iOS and Android applications are deferred.
- **Instant booking.** Availability is checked by the system and an eligible slot is booked without owner approval.
- **Workspace-first inventory.** A Workspace, not a Salon, is the bookable resource.
- **Capacity one by default.** One Workspace accepts one non-conflicting booking at a time unless capacity is explicitly expanded in a later phase.
- **Role-aware accounts.** One user may be both a Beauty Professional and an Owner/Manager; users switch role/mode rather than maintain duplicate accounts.
- **Chat is supportive, not blocking.** Messaging can help coordination but never sits on the critical booking path.

---

## 2. Actors and Role Model

| Actor | Primary goal | Phase 1 permissions |
|---|---|---|
| Guest | Discover supply before creating an account | Browse, search, view Salon/Workspace details, indicative pricing and availability, register or log in |
| Beauty Professional | Find and book a workspace | Search, select availability, create/manage own bookings, message, manage professional profile/license details |
| Owner/Manager | Make and operate workspace supply | Manage salons, workspaces, prices, rental options, availability, bookings and messages |
| Admin | Keep the marketplace operable | Inspect/manage users, salons, workspaces and bookings; disable unsafe users/listings |

### Multi-role rule

Roles are additive to a single user identity:

```text
User
 |- Beauty Professional role
 `- Owner/Manager role
```

The same person may rent another salon's workspace while managing one or more salons of their own. The application must therefore offer role-aware navigation and a clear mode switch, while identity, account settings, and messages remain shared.

### Professional license handling

Phase 1 collects professional/license information as profile data. Automated license verification is not required. Admin/manual review may support exceptions when needed.

---

## 3. Core Product Domains

1. **Identity & Access** - registration, login, account security, role assignment and mode switching.
2. **User & Professional Profile** - personal details, professional details, license information.
3. **Salon Management** - business identity, location, photos and the container for workspaces.
4. **Workspace Management** - the bookable resource, its photos, amenities, price and rental options.
5. **Search & Discovery** - location/date/price-based discovery of available supply.
6. **Availability** - owner-configured availability and blocked periods, combined with booking occupancy.
7. **Booking** - reservation lifecycle, booking details, cancellation and history.
8. **Messaging & Notification** - direct conversation, booking and license-expiry communication.
9. **Administration** - operational inspection and safe disable actions.

---

## 4. Key Domain Relationships

```text
User
 |- manages -> Salon
 |              `- contains -> Workspace
 |                               |- price and rental options
 |                               |- photos and amenities
 |                               `- availability rules / blocked periods
 |
`- books -> Booking <- reserves a Workspace and time interval
                   `- may be referenced by -> Conversation / Notification
```

### Domain rules that must remain explicit

- A **Salon** is a business/location context. It is not directly booked.
- A **Workspace** is the supply unit selected by a Beauty Professional and reserved by a Booking.
- A standalone `Listing` entity is not required in Phase 1 unless it gains independent lifecycle or business rules. Publishability can initially be a Workspace concern.
- Availability belongs to the Workspace domain and is evaluated together with confirmed/held bookings.
- A Conversation may be associated with a Salon, Workspace, or Booking for context, but it does not approve or create the booking.

---

## 5. Booking Model

### Target flow

```text
Professional selects Workspace + date/time
        -> system validates availability
        -> server reserves the slot atomically
        -> booking is confirmed
```

This replaces a request-and-owner-approval model. The Owner/Manager does not manually accept each booking. The system is responsible for preventing conflicting reservations through an atomic server/database reservation.

### Phase 1 booking lifecycle

```text
Draft / selection
        -> Confirmed
        -> Completed

Confirmed -> Cancelled or rescheduled
```

The exact timeout value, cancellation cutoff, and remaining-balance collection rule are business policies to configure later; they should not be hidden inside frontend logic.

---

## 6. Availability Model

Availability is a core operational domain, not merely a calendar screen.

An Owner/Manager configures availability at the **Workspace** level:

- Rental options: full day, half day, and/or configured time options.
- Available dates and periods.
- Blocked/unavailable periods.
- Price appropriate to the applicable rental option.

The system combines owner configuration with booking occupancy. Phase 1 uses:

```text
default_workspace_capacity = 1
```

Therefore, a confirmed booking for a time interval makes the same overlapping interval unavailable for another booking on that workspace. Creation checks and reservations run atomically on the server/database; Calendar synchronization with Google Calendar or Apple Calendar is explicitly deferred.

---

## 7. Scope guardrail: booking without payment processing

The current Phase 1 baseline is **instant booking from availability**. The platform records a booking and its lifecycle, but does **not** process a payment, platform fee, payout, refund or financial ledger. Price is display/booking-context data only in this scope.

```text
Availability check + atomic reservation -> CONFIRMED booking
```

Payment integration may be evaluated later as a separate product and compliance decision. It must not become a hidden dependency of the Phase 1 booking flow.

---

## 8. Messaging Principle

Messaging is available for coordination between Professionals and Owners/Managers, including questions about a salon, workspace, or an existing booking.

```text
Independent paths:
Search -> Availability -> Confirmed booking

Professional <-> Owner/Manager messaging
```

The product must not require a chat, a reply, or owner approval before a booking can be completed.

---

## 9. Complete Overall Sitemap

```text
THE SALON SPOT
|
|- PUBLIC
|  |- Home
|  |- Search
|  |  `- Search Results
|  |- Salon Detail
|  |  `- Workspace List
|  |- Workspace Detail
|  |  |- Photos
|  |  |- Description and amenities
|  |  |- Pricing and rental options
|  |  `- Availability selection
|  `- Authentication
|     |- Login
|     |- Register
|     `- Forgot Password
|
|- PROFESSIONAL
|  |- Dashboard / Explore
|  |- Search and Workspace Detail
|  |- Create Booking
|  `- Booking Confirmation
|  |- My Bookings
|  |  |- Upcoming
|  |  |- Completed
|  |  |- Cancelled
|  |  `- Booking Detail
|  |- Messages
|  |  `- Conversation
|  `- Profile
|     |- Personal information
|     `- Professional / license information
|
|- OWNER / MANAGER
|  |- Dashboard
|  |- My Salons
|  |  |- Salon List
|  |  |- Create Salon
|  |  `- Salon Detail / Edit
|  |     |- Information
|  |     |- Location
|  |     |- Photos
|  |     `- Workspaces
|  |- Workspaces
|  |  |- Workspace List
|  |  |- Create Workspace
|  |  `- Workspace Detail / Edit
|  |     |- Information
|  |     |- Photos and amenities
|  |     |- Pricing and rental options
|  |     `- Availability settings
|  |- Availability
|  |  |- Calendar
|  |  |- Available periods
|  |  `- Blocked periods
|  |- Bookings
|  |  `- Booking Detail
|  |- Messages
|  |  `- Conversation
|  `- Profile
|
|- ACCOUNT (shared)
|  |- Profile
|  |- Role / mode switch
|  |- Settings
|  `- Logout
|
`- ADMIN
   |- Dashboard
   |- Users -> User Detail
   |- Salons -> Salon Detail
   |- Workspaces -> Workspace Detail
   |- Bookings -> Booking Detail
   `- Disable user / listing
```

---

## 10. Detailed Professional Sitemap

```text
Professional
|- Home / Explore
|- Search
|  |- Location
|  |- Date
|  |- Price
|  `- Search Results
|- Workspace Detail
|  |- Salon information
|  |- Photos
|  |- Amenities
|  |- Pricing
|  |- Rental options
|  `- Availability selection
|- Create Booking
|  |- Selected workspace
|  |- Date and time
|  |- Booking price
|  `- Confirm booking
|- Booking Confirmation
|- My Bookings
|  |- Upcoming
|  |- Completed
|  |- Cancelled
|  `- Booking Detail / Cancel where eligible
|- Messages
|  `- Conversation
`- Profile
   |- Personal information
   `- Professional and license information
```

**UX decision:** availability selection belongs in Workspace Detail. The Professional should not need to navigate to a separate availability module just to select a bookable time.

---

## 11. Detailed Owner/Manager Sitemap

```text
Owner/Manager Dashboard
|- My Salons
|  `- Salon
|     |- Information
|     |- Location
|     |- Photos
|     `- Workspaces
|- Workspaces
|  `- Workspace
|     |- Information
|     |- Photos
|     |- Amenities
|     |- Pricing
|     |- Rental options
|     `- Availability settings
|- Availability
|  |- Calendar
|  |- Available periods
|  `- Blocked periods
|- Bookings
|  `- Booking Detail
|- Messages
|  `- Conversation
`- Profile
```

Availability appears in two navigation contexts but remains one domain:

- **Workspace -> Availability settings** configures the workspace.
- **Availability -> Calendar** supports daily operational management across workspaces.

---

## 12. Concise Admin Sitemap

```text
Admin
|- Dashboard
|- Users
|- Salons
|- Workspaces
|- Bookings
`- Disable user / listing
```

Admin is an operations surface for inspect, manage, override, and manual recovery. Phase 1 does not require an enterprise back-office or advanced analytics suite.

---

## 13. Explicitly Out of Scope for Phase 1

- Google Calendar or Apple Calendar synchronization.
- Native iOS or Android applications.
- AI agent console or support-agent portal.
- Advanced analytics, recommendation engine, or complex reporting.
- Payment processing, platform fee, payout, refund, financial ledger or provider webhook.
- Automated professional license verification.
- Reviews/ratings and favorites unless subsequently required by the business.
- Multi-capacity resource allocation and group bookings beyond the default capacity-one model.

---

## 14. Sitemap vs. Backend Module Architecture

The sitemap is an information architecture: it inventories pages, navigation, and functional spaces for each actor. It is not a one-to-one backend architecture.

| Sitemap perspective | Backend/domain perspective |
|---|---|
| Workspace Detail shows photos, pricing and availability together | Workspace, media/pricing, and Availability domains collaborate |
| Owner has both Workspace Availability Settings and a Calendar | One Availability domain serves both screens |
| Create Booking is one screen flow | Booking and Availability coordinate atomically; Notification follows the booking result |
| Admin screens are grouped for operations | Admin uses controlled access to several underlying domains |

Suggested module boundaries for implementation are therefore: Identity & Access, User/Profile, Salon, Workspace, Search, Availability, Booking, Messaging, Notification, and Administration. Module boundaries should follow business ownership and data consistency, not individual frontend pages.

---

## 15. Function List Phase 1

**Priority rule:** `P0` = bắt buộc cho core flow, data integrity hoặc security; `P1` = quan trọng để vận hành Phase 1 tốt nhưng không chặn end-to-end core; `P2` = tiện ích/deferred.

**Scope guardrail:** Instant booking dựa trên availability; chat độc lập; license expiry có notification. Không có payment/platform fee trong Function List này.

| Function ID | Function | Priority | Why / Dependency |
|---|---|---|---|
| AUTH-001 | Register | P0 | Tạo identity cho mọi protected flow. |
| AUTH-002 | Login | P0 | Xác thực để truy cập chức năng theo role. |
| AUTH-003 | Logout | P0 | Kết thúc session an toàn. |
| AUTH-004 | Forgot/reset password | P1 | Khôi phục account; không chặn demo core ban đầu. |
| AUTH-005 | Update profile | P1 | Duy trì account data; sau `AUTH-001`. |
| PROF-001 | Create professional profile | P0 | Prerequisite cho Professional tạo booking. |
| PROF-002 | Update professional profile | P1 | Vận hành hồ sơ; sau `PROF-001`. |
| PROF-003 | Add/update license | P0 | Dữ liệu eligibility của Professional. |
| PROF-004 | Upload license/insurance document | P1 | Bằng chứng cho manual support; không OCR/KYC. |
| PROF-005 | Check license validity | P0 | Chặn booking mới khi license hết hạn. |
| SALON-001 | Create salon | P0 | Tạo nguồn cung và ownership. |
| SALON-002 | Update salon | P1 | Bảo trì listing; sau `SALON-001`. |
| SALON-003 | View own salons/workspaces | P1 | Vận hành nhiều listing; sau `SALON-001`. |
| SALON-004 | Create/update workspace | P0 | Workspace là đơn vị bookable. |
| SALON-005 | Upload workspace images | P1 | Hỗ trợ discovery và chất lượng listing. |
| SALON-006 | Set workspace amenities | P1 | Dữ liệu detail/filter; sau `SALON-004`. |
| SALON-007 | Deactivate salon/workspace | P0 | Ngăn booking mới, vẫn giữ lịch sử. |
| AVAIL-001 | Set available date/slot | P0 | Nguồn dữ liệu cho instant booking. |
| AVAIL-002 | Update/remove availability | P1 | Điều chỉnh lịch vận hành; sau `AVAIL-001`. |
| AVAIL-003 | Block date/slot | P0 | Bảo vệ availability và tránh booking sai. |
| AVAIL-004 | View availability | P0 | Cần cho Owner vận hành và Professional chọn slot. |
| SEARCH-001 | Browse workspace | P0 | Entry point discovery của marketplace. |
| SEARCH-002 | Search by location | P0 | Tìm supply theo nhu cầu cốt lõi. |
| SEARCH-003 | Filter by date/price/amenities | P1 | Matching tốt hơn; dùng dữ liệu Search/Availability. |
| SEARCH-004 | View workspace detail | P0 | Cần trước khi kiểm tra và tạo booking. |
| BOOK-001 | Check availability | P0 | Gate trước reservation; phụ thuộc Workspace + Availability. |
| BOOK-002 | Create booking | P0 | Hoàn thành core marketplace flow. |
| BOOK-003 | Prevent double booking | P0 | Data integrity; transaction/constraint server-side. |
| BOOK-004 | View booking list/detail | P0 | Xác nhận và quản lý booking đã tạo. |
| BOOK-005 | Cancel booking | P1 | Vận hành Phase 1; release slot theo policy. |
| BOOK-006 | Reschedule booking | P1 | Cần check/reserve slot mới; không qua chat. |
| BOOK-007 | Update booking status | P0 | Lifecycle controlled command, không raw status edit. |
| CHAT-001 | Start conversation | P1 | Điều phối hữu ích nhưng độc lập Booking. |
| CHAT-002 | View conversation list | P1 | Truy cập chat đang tồn tại. |
| CHAT-003 | Send/read message | P1 | Giao tiếp vận hành; không mutate Booking. |
| NOTIF-001 | View notifications | P1 | In-app visibility cho event Phase 1. |
| NOTIF-002 | Booking notification | P1 | Thông tin cho hai bên sau booking action. |
| NOTIF-003 | License expiry notification | P1 | Hỗ trợ compliance; phụ thuộc `PROF-005`. |
| NOTIF-004 | Booking confirmation email | P1 | Receipt/communication; gửi sau booking confirmed. |
| ADMIN-001 | View users | P1 | Support và moderation cơ bản. |
| ADMIN-002 | View salons/workspaces | P1 | Kiểm tra listing và support. |
| ADMIN-003 | View bookings | P1 | Hỗ trợ exception; không sửa raw state. |
| ADMIN-004 | Disable user/listing | P0 | Safety/moderation; chặn access hoặc booking mới. |

### Deferred P2 note

Chưa có function P2 cần build trong list trên. Để scope gọn, **reviews/ratings, favorites, payment/platform fee, calendar sync và advanced analytics** được ghi nhận là deferred, không tạo table, API hay màn hình Phase 1.

---

## 16. Three P0 Core User Journeys

### P0-1: Owner/Manager publishes bookable supply

```text
Sign in / choose Owner mode
        -> create Salon with business and location details
        -> create Workspace with photos, amenities, price and rental options
        -> configure available and blocked periods
        -> publish
        -> Workspace is discoverable and bookable
```

**Success condition:** a Professional can find a Workspace with accurate price and availability.

### P0-2: Beauty Professional instant booking

```text
Search by location/date/price
        -> open Workspace Detail
        -> select an available rental option and time
        -> system validates and reserves the slot atomically
        -> booking is confirmed
```

**Success condition:** there is no owner-approval step and no overlapping confirmed booking for the same capacity-one workspace/time interval.

### P0-3: Booking management and cancellation

```text
Professional opens My Bookings
        -> opens Booking Detail
        -> cancels when eligible
        -> system marks booking cancelled
        -> the time is released according to availability rules
```

**Success condition:** both participants see a consistent booking state; Admin can inspect or recover exceptions. Messaging may support coordination, but it is not a required step.

---

## 17. Final Phase 1 Baseline Summary

```text
                         THE SALON SPOT - PHASE 1

Guest               Beauty Professional               Owner/Manager                Admin
Browse/search       Discover and book                 Create and operate supply    Operate exceptions
       |                      |                                  |                         |
       `--------------------> Workspace Marketplace <------------------------------'
                                  |
                       Salon (business/location)
                                  |
                       Workspace (bookable resource)
                         |        |          |
                     Pricing   Availability  Booking

Messaging: available alongside the journey; never a booking prerequisite.
Booking: instant after system availability validation and atomic reservation.
Capacity: 1 workspace booking at a time by default.
Platform: mobile-first PWA; external calendar sync deferred.
```

### Final decisions to carry into design and implementation

1. Build the inventory and data model around **Salon -> Workspace**, never around a directly-bookable Salon.
2. Treat **Availability** as the authoritative gate for instant booking and enforce conflict prevention server-side.
3. Keep payment/platform fee outside Phase 1; Booking is confirmed by availability reservation.
4. Keep **Messaging** separate from the booking transaction.
5. Support **multi-role users** through a shared account and role-aware experience.
6. Keep Phase 1 deliberately focused; add calendar sync, advanced finance, automation, and native apps only when the core marketplace loop is proven.

---

## 18. Recommended Next Artifacts

This baseline is ready to drive the next project-reference artifacts:

1. Booking state diagram, cancellation/reschedule rules and availability conflict cases.
2. Domain model and data schema with integrity constraints for overlapping bookings.
3. API contracts for search, availability, booking management, chat and notifications.
4. Mobile-first wireframes for the three P0 journeys.
5. Delivery backlog ordered by the P0 marketplace loop.
