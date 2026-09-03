# Test strategy and current evidence

## Verified automated seams

| Seam | Cases | Test type |
| --- | --- | --- |
| HTTP contract | Health response, request ID on success and guard denials, Discovery DTO validation, Auth DTO validation and response mapping | In-process HTTP integration |
| Discovery | Published/open Workspace response mapping and pagination | Unit |
| Password adapter | Correct password succeeds; different password fails | Unit |
| Access token | Valid HS256 token succeeds; tampered token and malformed bearer header fail | Unit |
| Professional access | Missing/suspended profile is denied; `ACTIVE` profile is required by hold and Booking guards/services | Unit + HTTP contract |
| Professional onboarding | Professional registration creates `PENDING`; authenticated `GET/PATCH /professionals/me` cannot mutate eligibility or verification | Unit + HTTP contract |
| Professional identity DB | Owner and Professional can both own User-scoped reset-token rows; credential validity and private evidence persist separately; mismatched case/Profile evidence is rejected by FK | Opt-in MySQL integration |
| Auth lifecycle | Registration normalization/audit, duplicate registration, failed login, refresh rotation, refresh reuse and concurrent claim failure | Unit |
| BOLA | `SalonMembership` ownership and `:salonId` authorization guard | Unit |
| Media storage | Signed PUT, MIME binding, byte/pixel limits, real image decode, EXIF stripping and SHA-256 metadata | Unit with real filesystem + `sharp` |
| Media processing failure | Raw Sharp/storage detail is server-logged only; client, persisted failure reason and audit receive the safe message | Unit |
| Media HTTP | JPEG/PNG/WebP DTO allowlist and authenticated actor mapping | In-process HTTP integration |
| Supply media BOLA | Nested Workspace must belong to the authorized Salon before upload intent | Unit |
| Publish | Pending media blocks publish; valid supply is published and audited transactionally | Unit |
| Availability contract | Exact local date, allowlisted/unique fixed periods, domain error codes | Unit |
| Availability rules | Open/reopen/block batch, future-only mutation, `HELD`/`BOOKED` immutability and audit | Unit |
| Availability concurrency | Concurrent open/block is serialized by `WorkspaceCalendarLock` and leaves one consistent day state | MySQL 8.4 integration (opt-in) |
| Booking snapshot timezone | Confirm stores the Salon timezone/local date; web formats time/date from the snapshot instead of browser timezone | Unit |
| URL navigation | Route state covers discovery query, Workspace detail, Bookings, Owner, Admin and login return path | Typecheck; browser UAT pending |

## Reliability rules now covered

- A refresh token is claimed with an atomic conditional update before a replacement is created. If another request has already claimed it, no second replacement is created and the active family is revoked.
- Unknown or malformed HTTP fields are rejected at the DTO boundary.
- `RequestIdMiddleware` assigns and returns `x-request-id` before guards. The same value appears in API error bodies for missing token, Professional-role, Salon-owner and Admin denials; CORS exposes the header to the web client.
- Only an `ACTIVE` `ProfessionalProfile` can hold, confirm, read or cancel a booking. Owner membership and Admin access are not substitutes.
- Booking uses UTC instants for lifecycle decisions and snapshots Salon `timezone`/`localDate` for display.
- A user without the requested Salon membership cannot pass the Owner authorization seam.
- A signed upload is bound to one storage key, content type, byte limit and expiry; filename/MIME metadata from the client is not treated as proof of image validity.
- Public reads expose only media that has decoded and reached `READY`; delete hides media before asynchronous cleanup. A processing failure stores and returns a fixed safe message, while raw Sharp/storage diagnostics are logged with `mediaId` and `requestId` only.
- Owner schedule mutation first creates-or-observes the calendar lock row, locks it with `FOR UPDATE`, then evaluates and writes the whole batch. `HELD` and `BOOKED` make the batch fail without partial updates.
- API errors preserve approved domain codes such as `PAST_SLOT_IMMUTABLE`, `ACTIVE_CHECKOUT_IMPACT`, `BOOKED_SLOT_IMMUTABLE` and `IDEMPOTENCY_CONFLICT`.

Coverage is measured only for executable functionality that exists today. Empty capability shells, process entrypoints and unimplemented worker code are intentionally excluded; they do not represent delivered behavior.

## MySQL verification and test environment

Use a dedicated MySQL database, preferably the Docker database, for tester/UAT work. Apply existing migrations with `migrate deploy`; do not use `migrate dev` merely to start the system because it creates a temporary shadow database and therefore needs database-creation privileges.

```powershell
docker compose up -d mysql
pnpm prisma:generate
Push-Location apps/api
pnpm exec prisma migrate deploy --schema prisma/schema.prisma
Pop-Location
pnpm --filter @salon-spot/api test
```

Run the opt-in D5 race suite only against a disposable/local test database:

```powershell
$env:RUN_MYSQL_E2E='1'
pnpm --filter @salon-spot/api test -- --runTestsByPath test/availability.mysql.spec.ts
```

Local MySQL E2E previously verified refresh-cookie rotation, logout revocation, idempotent Workspace retry, validation errors, fresh migration on MySQL 8.4, and concurrent D5/open-block plus D6-D8 booking races. Current code-level run on 28/08/2026: API 39 suite/99 test passed with opt-in MySQL suites skipped by default; the new Professional identity MySQL suite passed 3/3 against both a fresh disposable database and the migrated local database; web 7/7; monorepo typecheck passed. Browser validation on local Vite now confirms direct `/owner` and Workspace URLs, refresh, browser-back and Owner/Admin visibility at 375px; it does not replace authenticated API/MySQL UAT. Automated tests still do not prove every database transaction race. Use the manual runbook for repeatable UI/API checks, then add a dedicated test database for media cap/cleanup and concurrent confirm/cancel.

Before MVP go/no-go, verify browser refresh/direct-link/back for every route, Owner/Admin mobile navigation at 320/375/768px, multiple Salon/viewer timezone combinations, a non-Professional role matrix, concurrent confirm/cancel, and D3-D4 media cap/cleanup recovery on MySQL.

Before enabling verification-based booking eligibility, add workflow tests for submit/review/resubmit/revoke, short-lived private download authorization, license validity through the target slot end, confirm-time recheck, and legacy-profile backfill. Password reset additionally needs non-enumerating request responses, one-time/expiry/replay tests, session revocation policy and real email-delivery evidence.

## P1 release-assurance execution

`RUN_MYSQL_E2E` is no longer optional in the release workflow. Run `pnpm p1:mysql` only with a disposable `DATABASE_URL`; it applies real migrations before the MySQL test paths. The suite asserts direct database state for open/block, competing holds, replay/cross-user denial, expiry/confirm, concurrent same-hold confirm, concurrent cancel, expired outbox-lease reclaim, media active-cap and cleanup retry. `p1-http-bola.mysql.spec.ts` boots the real Nest HTTP application against MySQL and verifies cross-Salon owner/Admin/Professional denial, PENDING-versus-ACTIVE hold access and suspension/refresh revocation.

Chromium Playwright runs through the packaged same-origin runtime with traces, video and screenshots retained on failure. Its checked-in flows cover deep links, refresh/back, role-specific login boundaries and 320/375/768 navigation. It does not replace the manual two-Salon/two-browser-timezone and mutation UAT record; attach request IDs and direct database results to `P1_TEST_EVIDENCE.md`.

Backup/restore uses `compose.p1-backup.yaml`, never a developer/UAT database. The report carries only synthetic data and must be attached to the candidate evidence bundle.
