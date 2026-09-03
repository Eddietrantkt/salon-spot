# P1 Test Evidence Record

> This is the current local evidence record, not a release approval. `NOT RUN`, `UNAVAILABLE`, and `FAILED` are not passing results.

| Field | Value |
| --- | --- |
| Candidate commit SHA | `UNAVAILABLE — checkout has no configured Git remote/candidate` |
| Image digest | `UNAVAILABLE — no candidate image registry` |
| CI workflow/artifact URL | `UNAVAILABLE — workflow source exists but has not run on a selected Git host` |
| Environment and MySQL image digest | `LOCAL — MySQL 8.4.11; candidate image digest unavailable` |
| Decision owner and timestamp | `UNASSIGNED — local verification 2026-09-03` |

## Automated gates

| ID | Gate | Status | Artifact / request IDs | Notes |
| --- | --- | --- | --- | --- |
| P1-CI-01 | Lockfile install, typecheck, API/web tests and production build | PARTIAL LOCAL PASS | `pnpm build` passed; no clean CI artifact | Full clean install/typecheck/test remains NOT RUN for candidate |
| P1-DB-01 | Open/block race; two Professionals hold; replay/cross-user denial; expiry/confirm | NOT RUN |  | Requires disposable MySQL P1 E2E record |
| P1-DB-02 | Concurrent confirm and cancel DB invariants | NOT RUN |  | Requires disposable MySQL P1 E2E record |
| P1-DB-03 | Worker expiry/confirm, outbox lease reclaim, media cap and cleanup/retry | PARTIAL LOCAL PASS | `artifacts/p1-runtime-smoke/report.json` | Recovery outbox fixture delivered; full MySQL suite remains NOT RUN |
| P1-SEC-01 | HTTP/DB BOLA and role capability matrix | NOT RUN |  | Requires disposable MySQL HTTP/DB run |
| P1-RUN-01 | Compose API, web and worker readiness | LOCAL PASS | `artifacts/p1-runtime-smoke/report.json` | migrate exit 0; HTTP 200; restart count 0→1; all heartbeats advance |
| P1-BACKUP-01 | Isolated MySQL 8.4 backup/restore report and post-restore smoke | LOCAL PASS | `artifacts/p1-backup-restore/report.json` | synthetic dump 38,842 bytes; exact count invariant; API/worker 200 |

## Manual browser UAT

For every run attach the Playwright trace/screenshot and record the request ID from the UI/API error or response. Query the disposable DB immediately after the journey and record the invariant result.

| ID | Journey | Status | Request ID | Screenshot/trace | DB result |
| --- | --- | --- | --- | --- |
| P1-UAT-01 | Owner A tries Owner B Salon/Workspace mutation | NOT RUN |  |  | no mutation |
| P1-UAT-02 | Professional, Owner and Admin attempt out-of-role routes | NOT RUN |  |  | denied consistently |
| P1-UAT-03 | PENDING Professional cannot hold/confirm; ACTIVE can | NOT RUN |  |  | expected slot/booking only |
| P1-UAT-04 | Suspend revokes access/refresh; reactivate does not revive old session | NOT RUN |  |  | sessions revoked |
| P1-UAT-05 | Refresh/direct URL/back: discovery, detail, bookings, owner, admin, onboarding | NOT RUN |  |  | no unintended mutation |
| P1-UAT-06 | Two Salon timezones × two browser timezones show booking snapshot time | NOT RUN |  |  | snapshot unchanged |
| P1-UAT-07 | Role navigation at 320, 375 and 768 px | NOT RUN |  |  | no role route missing |

## Decision

- [ ] GO — all required rows pass and no P0/P1 defect is open.
- [x] NO-GO — no Git candidate/artifact; P1 DB/browser/manual UAT gates are not run.

Open release blockers: select/connect a Git host; run candidate CI; execute disposable MySQL and controlled browser UAT. Deferred scope remains provider delivery/retry, payment, full Professional review, password-reset delivery, HA and monitoring SaaS.
