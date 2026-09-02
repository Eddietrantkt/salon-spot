# Backend foundation module map

This module map describes the current MySQL/Prisma Core MVP implementation. Payment and chat remain unapproved; booking, Professional access and Admin operations are implemented boundaries.

```text
apps/api/src/
├─ common/
│  ├─ config/                 shared API and worker configuration
│  ├─ database/prisma/        single Prisma adapter and lifecycle
│  ├─ health/                 operational health endpoint
│  └─ worker/                 optional worker process foundation
├─ modules/
│  ├─ discovery/              implemented public read module
│  ├─ auth/                    JWT/session lifecycle implemented
│  ├─ users/ professionals/    # Professional profile + booking access guard
│  ├─ salons/ workspaces/ media/ # Owner supply + media D3-D4 implemented
│  ├─ availability/ bookings/ payments/ # payment remains deferred
│  └─ chat/ admin/            # chat deferred; Admin operations implemented
├─ app.module.ts
├─ main.ts
└─ worker-main.ts
```

## Rules for future vertical slices

1. Add a controller only when a public HTTP interface is approved.
2. Put request DTOs in `presentation`, use-case orchestration in `application`, and database/provider details behind the module implementation.
3. A feature module owns writes to its aggregate. Cross-module writes need an explicit application-level use case and one transaction owner.
4. Add a worker job with its owning module only after its persistence state and idempotency rule exist.
5. Keep `packages/contracts` transport-only: no Prisma models or database client.

## Current implementation

`DiscoveryModule` is the public read reference and exposes only `READY` media for `PUBLISHED` Workspaces with `OPEN` slots. `AuthModule` owns password/session lifecycle and will own role-agnostic password recovery; only reset-token persistence exists today. `ProfessionalsModule` owns the active-profile policy used by hold and Booking routes and the future verification/credential workflow; neither `SalonMembership` nor `AdminAccess` implies this capability. Private Professional documents use a separate storage policy from public listing media. `SalonsModule`, `WorkspacesModule` and `MediaModule` implement the Owner slice. `AvailabilityModule` owns fixed slots, holds and expiry with Workspace/day locking. `BookingsModule` owns confirm, immutable snapshots (including Salon timezone/local date), cancellation and completion. Payment and chat remain deferred; `AdminModule` implements bounded operational reads/account status controls, while verification review will require a narrow Admin permission.
