# The Salon Spot - Core MVP web and backend

This repository contains the active web, API and database implementation for the two-week Core MVP described in `The_Salon_Spot_Backend_Technical_Baseline_2Week_MySQL_MVP_VI.docx`.

## Current implementation boundary

Implemented now: pnpm workspace, MySQL 8.4/Prisma, NestJS modular monolith, React/Vite mobile-first web, JWT access/refresh sessions, Salon-scoped Owner BOLA, separate `AdminAccess`, explicit `ProfessionalProfile`, additive Professional verification/private-document and role-agnostic password-reset persistence, Owner supply/media/publish, fixed availability, and the full no-payment booking lifecycle: detail → hold → confirm → cancel/complete.

Only an `ACTIVE` Professional profile may currently hold, confirm, read or cancel its own booking. The new verification status and credential records are intentionally not enforced until onboarding, Admin review and legacy-account rollout are complete. Owner membership and Admin access never grant booking authority by themselves. Bookings snapshot the Salon IANA timezone and local calendar date as well as their UTC start/end instants, so history is rendered in the Salon timezone. Payment, chat, Manager, rescheduling and a real email provider remain out of scope.

## Local startup

1. Copy `.env.example` to `apps/api/.env`; replace every placeholder secret. The example uses Docker port `3307` from `compose.yaml`.
2. Start MySQL with `docker compose up -d mysql`.
3. Install dependencies with `pnpm install`.
4. Generate Prisma Client with `pnpm prisma:generate`.
5. Apply migrations with `Push-Location apps/api; pnpm exec prisma migrate deploy --schema prisma/schema.prisma; Pop-Location`.
6. Run the API with `pnpm --filter @salon-spot/api dev`.

For D3-D4 media, also set `MEDIA_UPLOAD_SECRET`, `MEDIA_PUBLIC_BASE_URL` and `MEDIA_STORAGE_ROOT`. Run the cleanup worker with `pnpm --filter @salon-spot/api worker:dev`; local media files are intentionally excluded from Git.

## Staging/UAT Compose runtime

For the single-instance packaged runtime, copy `.env.runtime.example` to `.env.runtime`, replace all placeholder secrets, and run `pnpm runtime:up`. The stack exposes the web/API proxy at `http://localhost:8080`; MySQL remains on host port `3307`. It runs `prisma migrate deploy` as a one-shot gate before API and worker, shares a named media volume between API and worker, and restarts the worker when it exits after a stale-job watchdog decision. See [the runtime operations runbook](docs/RUNTIME_OPERATIONS_RUNBOOK.md) for start/stop, health, recovery, smoke, and rollback procedures.

## Local demo data

After MySQL migrations are applied, run `pnpm --filter @salon-spot/api demo:seed`. The repeatable local seed creates an Owner, an Admin with Professional-review permission, and an `ACTIVE`/`APPROVED` Professional profile with demo license and insurance metadata, two salons (D1/D3), three published workspaces with generated local cover images, one draft workspace, seven days of fixed slots, and sample upcoming/cancelled/completed bookings.

For a separately registered local account, activate the booking capability explicitly with `pnpm --filter @salon-spot/api professional:grant -- person@example.com`. This local-operations command is audited and is intentionally separate from both Salon ownership and Admin access.

| Account | Email | Password | Demonstrates |
| --- | --- | --- | --- |
| Owner | `owner.demo@salonspot.local` | `SalonDemo#2026` | Owner Console, media, publication and schedules |
| Admin | `admin.demo@salonspot.local` | `SalonDemo#2026` | System Admin overview and operations |
| Professional | `professional.demo@salonspot.local` | `SalonDemo#2026` | Hold, confirmation and Booking history |

The seed updates only records identified by its demo emails and `demo_*` identifiers, so it is safe to rerun in a local demo database. Do not run it against production data: it deliberately resets the demo accounts, slots and sample bookings to their known state.

Observable endpoints include `GET /api/v1/health`, `GET /api/v1/workspaces?area=D1&date=2099-12-17`, `GET /api/v1/workspaces/:workspaceId?date=YYYY-MM-DD`, and the Professional hold/confirm/booking routes documented in `docs/D6_D8_BOOKING_DELIVERY.md`. The optional worker starts with `pnpm --filter @salon-spot/api worker:dev`.

Every API response, including a 401/403 guard denial, returns `x-request-id` and the same value in the error body; CORS exposes this header to the web client. Image processing failures return a safe user message while detailed storage/Sharp diagnostics remain in server logs.

Identity endpoints: `POST /api/v1/auth/register`, `POST /api/v1/auth/login`, `POST /api/v1/auth/refresh`, `POST /api/v1/auth/logout`, and authenticated `GET /api/v1/auth/me`. Register/login/refresh set the rotating refresh token only as an `HttpOnly` cookie; the browser keeps the short-lived access token in memory and restores it through `/auth/refresh` after reload. Set the two non-placeholder secrets in `.env` before starting the API.

`PasswordResetToken` is attached to `User`, so future password recovery applies equally to Professional, Owner and Admin identities. The request/confirm endpoints and email delivery are not implemented yet; the database never stores a raw reset token.

## Non-negotiable ownership rules

- `AvailabilitySlot` state/time may be mutated only by the Availability module.
- Booking creation and slot state transition must occur in the same MySQL transaction.
- Booking commands require an active `ProfessionalProfile`; this is independent of Owner and Admin authority.
- Professional verification documents are private evidence, not `SalonMedia`/`WorkspaceMedia`; MySQL stores metadata only.
- Booking snapshots preserve the Salon-local date/timezone; the web must not render them in browser-local time.
- External storage/email calls happen only after database commit, via outbox/worker.
- Client-provided price, time, and authorization context are never authoritative.
