# P1 Test Evidence Record

> Local P1 evidence for the exact candidate below. This is a controlled, disposable-fixture result; it is not an assertion about an external notification provider, payments, HA, or hosted CI access that was not available in this session.

## Successor candidate preparation — 2026-09-04

The working tree based on `631d2856dcac68edf83abb77f54c89495959ec3b` contains the isolated browser/runtime/backup runner changes and is **not yet a signed candidate**. Local verification completed before freezing the SHA:

| Gate | Result | Evidence |
| --- | --- | --- |
| Typecheck and production build | PASS | Local command output; no candidate SHA assigned yet |
| API and web tests | PASS | API 42 suites/112 tests; web 7/7 |
| Mandatory MySQL E2E | PASS | Clean disposable MySQL 8.4 rerun: 15/15 |
| Packaged browser UAT | PASS | `artifacts/p1-browser/2328-1788494024422/report.json`; seed 1,338 ms; Chromium 6/6; cleanup PASS |
| Runtime recovery | PASS | `artifacts/p1-runtime-smoke/11628-1788494484526/report.json`; restart count 0→1; readiness/heartbeats/outbox PASS |
| Backup/restore | PASS | `artifacts/p1-backup-restore/27116-1788495005670/report.json`; exact count invariant and restored API/worker readiness PASS |
| Hosted CI | PENDING | Requires an immutable commit SHA, hosted workflow URL and downloadable artifact |

This preparation record does not replace the historical `631d285` record below and does not authorize deployment. The hosted workflow generates `candidate.json` and a SHA-256 manifest from the exact SHA it runs.

## Historical local evidence — candidate `631d285`

| Field | Value |
| --- | --- |
| Candidate commit SHA | [`631d2856dcac68edf83abb77f54c89495959ec3b`](https://github.com/Eddietrantkt/salon-spot/commit/631d2856dcac68edf83abb77f54c89495959ec3b) (`master` resolves to this SHA) |
| Candidate image identifiers | Local disposable build: API `sha256:c7790417c3344b24af589e52987b5a1bebcf96ac2b73ee68f8255ea490330ad1`; worker `sha256:9554210eee8f55da647685c4396ce3f905c9b4c5a98280f4c392d671fe96511c`; web `sha256:3c4f5271fd9a8e6d020cde116c77f2f5db784b8783bca668171d51a38c3d2c56`. These are local Docker content IDs, not registry-published digests. |
| Environment | Disposable Compose project `salon-spot-p1-uat-631d285`; MySQL `8.4`; web `http://127.0.0.1:8089`; independent MySQL E2E container/database `salon_p1_uat_631d285` on host port `3314` |
| CI workflow/artifact URL | No hosted workflow run/artifact could be read with the available credentials (anonymous GitHub Actions API returned 404; GitHub CLI is absent). Local evidence paths and checksums below are the authoritative artifacts for this record. |
| Decision owner and timestamp | Codex local release-gate verification — 2026-09-03 15:59:43 +07:00 |

## Artifact manifest

All paths are local to this checkout and were created during this candidate run.

| Artifact | SHA-256 |
| --- | --- |
| `artifacts/uat-631d285/mysql-e2e.log` | `b6f6130b7d72a2cc5437c5c98eeca71b7ece2cc18de1661fed3fb21bee64f626` |
| `artifacts/uat-631d285/browser-gate.log` | `4006abf0cf145eeba92bf9337ca2bac93d9ff30ab29d56523a1f3d65ead39f34` |
| `artifacts/uat-631d285/timezone-browser-matrix.json` | `daad6eaf26795ed37e60a46b635aa18d4a7382608a47a495a439a08e650e4631` |
| `artifacts/uat-631d285/direct-routes.json` | `cbd1b1f7118d9d5e9cb50ee7ae6ed6636dd86a6a78bdee13a3cc5240797aab77` |
| `artifacts/uat-631d285/responsive-admin-reload.json` | `ff975cbc8e1a563b2b078c1293f260becaa2c5408c61a3c49d40d8f13e1ee552` |
| `artifacts/uat-631d285/typecheck.log` | `83cc9d74500384b966058227f711644399c04ecfd123871db19872bd3ebc97ab` |
| `artifacts/uat-631d285/unit-test.log` | `8fe52823cf86c52ad5c7a817c428f4c74035a4f23699a062eb192f2522bd2ad0` |
| `artifacts/uat-631d285/build.log` | `f06b19bc371eb3ea35575d40d6546ac9628a9f4a41bb0e822c71adb8cf3adf89` |

## Automated gates

| ID | Gate | Status | Artifact / request IDs | Notes |
| --- | --- | --- | --- | --- |
| P1-CI-01 | Typecheck, API/web tests and production build | LOCAL PASS | `typecheck.log`, `unit-test.log`, `build.log` | Typecheck passed; API 42 suites/112 passed (3 MySQL suites skipped by default); web 7/7; production build passed. |
| P1-DB-01 | Open/block race; two Professionals hold; replay/cross-user denial; expiry/confirm | PASS | `mysql-e2e.log` | Real disposable MySQL 8.4 suite passed 15/15. |
| P1-DB-02 | Concurrent confirm and cancel DB invariants | PASS | `mysql-e2e.log` | Included in the 15/15 real MySQL run. |
| P1-DB-03 | Worker expiry/confirm, outbox lease reclaim, media cap and cleanup/retry | PASS | `mysql-e2e.log` | Included in the 15/15 real MySQL run. |
| P1-SEC-01 | HTTP/DB BOLA and role capability matrix | PASS | `mysql-e2e.log` | Owner A/Owner B, Admin, ACTIVE/PENDING Professional, request IDs and mutation invariants exercised on disposable MySQL. |
| P1-RUN-01 | Compose API, web and worker readiness | PASS | `compose-up.stdout.log`, local image IDs above | Migration exited successfully; API, web and worker became healthy on the isolated Compose project. |
| P1-BACKUP-01 | Isolated MySQL 8.4 backup/restore report and post-restore smoke | LOCAL PASS | `artifacts/p1-backup-restore/report.json` | Existing rehearsal evidence remains valid; this candidate did not change the backup/restore implementation. |

## Controlled browser UAT

The fixture was disposable. The auxiliary MySQL E2E database completed with zero users, active sessions, holds, bookings and workspaces after suite cleanup; the Compose fixture is torn down after evidence capture.

| ID | Journey | Status | Request ID / evidence | DB result |
| --- | --- | --- | --- | --- |
| P1-UAT-01 | Owner A attempts Owner B Salon/Workspace mutation | PASS | `mysql-e2e.log` (`p1-http-bola.mysql.spec.ts`); each denied HTTP response carried `x-request-id` | Workspace count for Salon B was unchanged. |
| P1-UAT-02 | Professional, Owner and Admin attempt out-of-role routes | PASS | `mysql-e2e.log`; `browser-gate.log` | Cross-Salon writes by Owner, Admin and ACTIVE Professional returned 403; owner session was denied Admin console while Admin console accepted the Admin fixture session. |
| P1-UAT-03 | PENDING Professional cannot hold/confirm; ACTIVE can | PASS | `mysql-e2e.log` | PENDING hold returned 403 with zero holds; ACTIVE hold returned 201 with exactly one persisted hold. |
| P1-UAT-04 | Suspend revokes access/refresh; reactivation does not revive old session | PASS | `mysql-e2e.log` | Suspend returned 200; existing access and refresh returned 401; after reactivation the old refresh remained 401 and active-session count was zero. |
| P1-UAT-05 | Refresh/direct URL/back: discovery, detail, bookings, owner, admin, onboarding | PASS | `browser-gate.log`; `direct-routes.json`; `direct-routes.png` | Each of the six routes loaded after reload; browser back returned to discovery; no mutation was issued. |
| P1-UAT-06 | Two Salon timezones × two browser timezones render the booking snapshot | PASS | `timezone-browser-matrix.json`; `timezone-Asia-Ho-Chi-Minh.png`; `timezone-America-Los-Angeles.png` | Genuine fixture booking snapshots remained identical for browser zones `Asia/Ho_Chi_Minh` and `America/Los_Angeles`: Vietnam `15:00–17:00`, Los Angeles `19:00–21:00`. |
| P1-UAT-07 | Role navigation at 320, 375 and 768 px; Admin reload | PASS | `browser-gate.log`; `responsive-admin-reload.json`; responsive screenshots and `admin-reload.png` | Required navigation remained present at all three widths; authenticated Admin operations heading remained visible after reload. |

## Decision

- [x] **GO — local P1 gate:** every required automated and controlled UAT row above passed for SHA `631d285`; no P0/P1 defect was observed in the verified scope.
- [ ] NO-GO — a P0/P1 defect is open, or a required local UAT row is failed, blocked, or not run.

The hosted CI/artifact URL is not represented as a passing result because it was not accessible in this session. Attach an authenticated hosted-run URL before treating this local GO as a CI-attested deployment approval. Deferred scope remains external provider delivery/retry, payment, full Professional review, password-reset delivery, HA and monitoring SaaS.
