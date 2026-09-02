# P1 Test Evidence Record

> This file is a release record template. `PENDING` is not a passing result. Do not replace a failed result with a narrative.

| Field | Value |
| --- | --- |
| Candidate commit SHA | `PENDING` |
| Image digest | `PENDING` |
| CI workflow/artifact URL | `PENDING` |
| Environment and MySQL image digest | `PENDING` |
| Decision owner and timestamp | `PENDING` |

## Automated gates

| ID | Gate | Status | Artifact / request IDs | Notes |
| --- | --- | --- | --- | --- |
| P1-CI-01 | Lockfile install, typecheck, API/web tests and production build | PENDING |  |  |
| P1-DB-01 | Open/block race; two Professionals hold; replay/cross-user denial; expiry/confirm | PENDING |  |  |
| P1-DB-02 | Concurrent confirm and cancel DB invariants | PENDING |  |  |
| P1-DB-03 | Worker expiry/confirm, outbox lease reclaim, media cap and cleanup/retry | PENDING |  |  |
| P1-SEC-01 | HTTP/DB BOLA and role capability matrix | PENDING |  |  |
| P1-RUN-01 | Compose API, web and worker readiness | PENDING |  |  |
| P1-BACKUP-01 | Isolated MySQL 8.4 backup/restore report and post-restore smoke | PENDING |  |  |

## Manual browser UAT

For every run attach the Playwright trace/screenshot and record the request ID from the UI/API error or response. Query the disposable DB immediately after the journey and record the invariant result.

| ID | Journey | Status | Request ID | Screenshot/trace | DB result |
| --- | --- | --- | --- | --- |
| P1-UAT-01 | Owner A tries Owner B Salon/Workspace mutation | PENDING |  |  | no mutation |
| P1-UAT-02 | Professional, Owner and Admin attempt out-of-role routes | PENDING |  |  | denied consistently |
| P1-UAT-03 | PENDING Professional cannot hold/confirm; ACTIVE can | PENDING |  |  | expected slot/booking only |
| P1-UAT-04 | Suspend revokes access/refresh; reactivate does not revive old session | PENDING |  |  | sessions revoked |
| P1-UAT-05 | Refresh/direct URL/back: discovery, detail, bookings, owner, admin, onboarding | PENDING |  |  | no unintended mutation |
| P1-UAT-06 | Two Salon timezones × two browser timezones show booking snapshot time | PENDING |  |  | snapshot unchanged |
| P1-UAT-07 | Role navigation at 320, 375 and 768 px | PENDING |  |  | no role route missing |

## Decision

- [ ] GO — all required rows pass and no P0/P1 defect is open.
- [ ] NO-GO — identify owner, defect ID and corrective action below.

Open defects / explicitly deferred scope: `PENDING`
