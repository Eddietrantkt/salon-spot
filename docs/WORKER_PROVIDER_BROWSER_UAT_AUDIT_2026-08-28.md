# Worker, provider retry, and authenticated browser UAT audit — 2026-08-28

## Executive verdict

**FUNCTIONALLY WORKING BUT UNSTABLE**

## P0 runtime packaging follow-up — 2026-09-02

The source now contains the proposed single-instance Compose runtime: `compose.runtime.yaml`, a multi-stage `Dockerfile`, nginx same-origin `/api` proxying, a migration one-shot gate, shared media named volume, API `live`/MySQL `ready` probes, worker internal health endpoints, graceful shutdown, and a stale watchdog which exits code 1 for Compose to restart. Unit coverage was added for readiness failure/timeout, runtime health/staleness, watchdog exit, and worker shutdown tick suppression. API typecheck and the API/web test/build suites passed locally.

This is **not yet Compose smoke evidence**. Docker Desktop was reachable and the initial API/web image build completed before the runtime image was hardened with OpenSSL. The subsequent rebuild was blocked by Docker Hub anonymous-token TLS handshake timeout, so a fresh stack/migration/kill/restart/heartbeat/outbox demonstration must be rerun when image pulls are available. No provider exactly-once claim has been added: current evidence can only establish a conditional database lease transition with the development log sink.

The local MySQL/API/web booking flow was exercised through a real browser and reached a consistent `BOOKED` slot and `CONFIRMED` booking.  Worker lease recovery also worked after a manual restart.  The checkout does not define a production worker supervisor, however, and a real worker outage left a new booking notification event `PENDING` until an operator started `worker:dev` again.  Payment/provider retry is not implemented: the only booking delivery adapter is a development log sink.

## Scope and baseline

| Item | Observed value |
| --- | --- |
| Checkout | `D:\downloadD\salon_spot` |
| Git worktree/commit | **UNVERIFIED** — this directory has no `.git`; `git status` and `git rev-parse` fail. |
| Database | Docker MySQL 8.4, healthy, host port `3307` |
| API/web health | `GET /api/v1/health` → `200` JSON; web `/` → `200` |
| Runtime entrypoints | API: `apps/api/src/main.ts`; worker: `apps/api/src/worker-main.ts`; web: `apps/web/src/main.tsx` |

## Relevant data flow

```text
Browser → /api/v1 → Nest guards/services → Prisma → MySQL
                                    │
Booking/Media transaction ────────→ OutboxEvent
                                    │
worker-main (three 5 s loops) → lease/reclaim → heartbeat/log sink or media storage
```

`compose.yaml` provisions only MySQL. `package.json` exposes `worker` and `worker:dev`, but no Docker service, PM2, systemd, Kubernetes, or other restart supervisor was found.

## Test matrix

| Objective | Result | Evidence and boundary |
| --- | --- | --- |
| Worker controlled crash / stale heartbeat | **VERIFIED** | Killed the `worker:dev` process tree; old worker PID `14892` was terminated. After 18 seconds, all three heartbeat ages were 20 seconds, beyond the documented 15-second stale threshold. |
| Worker automatic restart | **FAILED** | No production supervisor exists in the checked configuration. The test restarted `worker:dev` manually; this is not automatic crash resilience. |
| Lease recovery after restart | **VERIFIED** | A deliberately abandoned valid `BOOKING_CONFIRMED` outbox lease (`audit_worker_recovery_20260828`) became `DELIVERED`, `attempts=1` after manual worker start; worker log recorded its acceptance. |
| Real outage impact | **VERIFIED** | During a later browser booking, worker had no running PID and heartbeat age about 782 seconds. New event `cmtcs20t2000qv2hof4r8z35y` was `PENDING`, `attempts=0`; after manual restart it became `DELIVERED`, `attempts=1`. Exit cause is **UNVERIFIED** from available logs. |
| Provider HTTP 500/timeout/429 retry | **UNIMPLEMENTED** | `PaymentsModule` is empty. `BookingNotificationOutboxService` only writes to Nest logs; no provider adapter, sandbox, request identity, webhook inbox, or provider response exists to exercise. |
| Internal outbox retry/reclaim model | **PARTIALLY_VERIFIED** | Source has conditional lease claim and `FAILED` backoff for booking/media outbox. The runtime recovery path was proven, but failure injection against a real external provider was impossible. |
| Public discovery/detail browser UAT | **VERIFIED** | `/?area=D1&date=2026-08-29` showed two workspaces; public detail and a refresh of `/workspaces/demo_ws_chair?...` rendered consistently with no console errors. |
| Professional authenticated browser UAT | **VERIFIED** | Signed in with local demo account; session survived refresh; selected a D3 slot, received the 10-minute hold state, confirmed booking, then refreshed and saw `CONFIRMED` booking plus three remaining public slots. |
| Owner authenticated browser UAT | **PARTIALLY_VERIFIED** | Owner console/session refresh and availability read succeeded. A real mutation opened D3 `09:00–11:00`; DB audit recorded `WORKSPACE_FIXED_SLOTS_OPENED`, `transitionedCount=1`. Cross-salon denial was not tested with an unrelated owner. |
| Admin authenticated browser UAT | **PARTIALLY_VERIFIED** | Admin session refresh and operations dashboard succeeded; it showed all worker health metrics and outbox/audit lists. No admin user-status mutation was executed. |
| Authorization states | **PARTIALLY_VERIFIED** | Professional opening `/admin` saw `Administrator access is required.` Unauthenticated `/owner` and `/admin` displayed sign-in states. Owner/Admin cross-salon and forced session expiry remain untested. |
| Mobile basic route check | **VERIFIED** | At 390×844, Owner and Admin navigation links remained visible; no console error observed. |

## Concrete runtime evidence

### Worker crash and recovery

1. Baseline showed `worker:dev` running with child `node ... dist/worker-main` PID `14892`.
2. `taskkill /PID 17372 /T /F` terminated the complete worker process tree. MySQL then showed `booking-lifecycle`, `hold-expiry`, and `media-cleanup` heartbeat ages of 20 seconds.
3. Before manual restart, an outbox fixture linked to an existing demo booking was inserted as `PROCESSING` with an expired lease. Starting the documented `pnpm --filter @salon-spot/api worker:dev` produced worker PID `15244`; MySQL changed fixture `audit_worker_recovery_20260828` to `DELIVERED`, `attempts=1` and the log wrote `Notification sink accepted ...`.
4. The authenticated booking later created `OutboxEvent` `cmtcs20t2000qv2hof4r8z35y` with `PENDING`, `attempts=0` while no worker PID existed and heartbeat was stale. A manual `worker:dev` start produced PID `13732`, logged acceptance of that exact event, and MySQL then reported `DELIVERED`, `attempts=1`, with all heartbeat ages under three seconds.

### Browser booking and database evidence

The intended fixture was Private Styling Studio, but the repeated Owner controls caused the audit operator to select the D3 control by ordinal position. This is a test-fixture selection mistake, not a product defect. The recorded mutation was therefore:

- Owner route: `/owner`; local date `2026-08-29`; D3 slot `09:00–11:00` changed `BLOCKED → OPEN`.
- Audit row: `Workspace / demo_ws_d3 / WORKSPACE_FIXED_SLOTS_OPENED`, request ID `9a62df97-9d45-4062-88fd-b27df9af5933`, `transitionedCount=1`.
- Professional route: `/workspaces/demo_ws_d3?area=D3&date=2026-08-29`.
- Visible results: hold message with ten-minute timer; then `Workspace reserved successfully. Your booking is confirmed.`
- Database after refresh: slot `demo_d3_1_0` = `BOOKED`; booking `cmtcs20rx000nv2hop8iw3820` = `CONFIRMED`, `localDate=2026-08-29`, `salonTimezone=Asia/Ho_Chi_Minh`; no linked `SlotHold` remained.
- Public HTTP: `GET /api/v1/workspaces/demo_ws_d3?date=2026-08-29` returned `200` and exactly the remaining three open slots, excluding `demo_d3_1_0`.
- Browser console: no captured warning/error in each exercised journey.

### Test runs

```text
pnpm --filter @salon-spot/api exec jest --runInBand \
  src/common/worker/hold-expiry-worker.service.spec.ts \
  src/common/worker/booking-lifecycle-worker.service.spec.ts \
  src/common/worker/media-cleanup-worker.service.spec.ts \
  src/common/worker/worker-health.service.spec.ts \
  src/modules/bookings/application/booking-notification-outbox.service.spec.ts \
  src/modules/media/application/media-cleanup.service.spec.ts
# 6 suites, 11 tests passed

pnpm --filter @salon-spot/web test
# 7 tests passed
```

These are useful source-level evidence only. They do not replace the worker process, MySQL, HTTP, or browser evidence above.

## Findings

### P0 — Worker availability depends on manual operator recovery

- **Reproduction:** stop the `worker:dev` tree; wait past the heartbeat stale threshold; create a booking while worker is absent.
- **Expected:** a production supervisor restarts the worker and pending outbox work resumes without an operator.
- **Actual:** no worker PID existed, heartbeats became stale, and the new booking notification was `PENDING` until `worker:dev` was manually started.
- **Root cause:** no deploy/supervisor configuration is present in `compose.yaml` or package scripts; exact reason the later worker process exited is not established by available logs.
- **Affected modules:** `compose.yaml`, `apps/api/package.json`, `apps/api/src/worker-main.ts`, `apps/api/src/common/worker/*`.
- **Evidence:** process/heartbeat/outbox sequence above.

### P1 — Provider retry cannot be release-validated because no provider exists

- **Reproduction:** inspect `apps/api/src/modules/payments/payments.module.ts` and booking outbox delivery service.
- **Expected:** an approved provider adapter/sandbox with controlled retryable/permanent failures, stable idempotency, and webhook dedupe if provider delivery is in scope.
- **Actual:** `PaymentsModule` is empty; booking notification delivery is a development log sink. No HTTP request, provider reference, inbox, signature verification, or sandbox exists.
- **Root cause:** intentionally deferred product capability, but it is not production evidence for external notification/payment retry.
- **Affected modules:** `apps/api/src/modules/payments/payments.module.ts`, `apps/api/src/modules/bookings/application/booking-notification-outbox.service.ts`.

### P2 — Authenticated UAT coverage remains incomplete at permission edges

- **Reproduction:** no independent second Owner or forced auth expiry was available/exercised in this run.
- **Expected:** explicit browser proof of cross-salon deny, session expiry/re-login state, and an Admin mutation/reload result.
- **Actual:** Admin deny for Professional and normal refresh persistence were observed; the remaining cases are unverified.
- **Affected modules:** owner/admin web features and their guarded API routes.

## Release-readiness gaps and dependency order

1. Add and operate a real worker supervisor/health policy (container, service manager, or orchestrator); then repeat kill/restart/heartbeat/outbox tests without manual start.
2. Add a fault-injectable external notification provider adapter with durable provider request identity; validate 500, timeout, 429, permanent error, recovery after worker restart, and idempotency.
3. Execute the remaining browser permission edges: unrelated Owner cross-salon attempt, forced access/refresh expiry, Admin suspend/reactivate a disposable account and reload/DB verify.
4. Repeat real-MySQL concurrency tests for confirm/cancel and expiry/confirm races before release.

## Explicit boundaries

### Verified

- MySQL/API/web local runtime, browser booking commit, slot/hold/booking consistency, public availability exclusion, manual worker recovery, and actual stale/outbox backlog behavior.

### Not verified

- Automatic restart in a production-style deployment, root cause of the later worker disappearance, forced session expiry, unrelated-owner BOLA browser case, Admin mutation, real provider retry/webhook behavior, browser screenshot artifacts.

### Blocked or unimplemented

- Real provider sandbox failures are **UNIMPLEMENTED** because no provider adapter exists.

### Must not be inferred

- Passing Jest/web unit tests do not prove crash resilience, real provider delivery, or release readiness.
