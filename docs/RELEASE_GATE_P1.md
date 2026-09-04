# P1 — Release Assurance Gate

P1 is a release gate. It does not add payment, a real notification provider, full Professional review, multi-region HA, or SaaS monitoring.

## Authority and baseline

- The checkout has `origin` on GitHub. A configured remote or workflow source is not CI evidence by itself: record the candidate SHA and an authenticated hosted workflow/artifact URL before treating a local gate as deployment approval.
- Once a Git host is selected, every release decision records the candidate SHA and image ID/digest. The workflow (`.github/workflows/release-gate-p1.yml`) must preserve every named gate and artifact below on any Git provider.
- Production secrets belong only in the chosen Git host/environment secret store and the deployment secret store. `.env`, `.env.runtime`, cookies, access tokens, refresh tokens and real dumps are ignored and must never be committed or uploaded as evidence.

## Required gates

| Gate | Command or job | Required evidence |
| --- | --- | --- |
| Clean install and static checks | `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm test`, `pnpm build` | workflow log and Jest output |
| Schema and MySQL integrity | `pnpm p1:mysql` | deployed migrations and real MySQL assertions |
| Packaged runtime recovery | `pnpm p1:runtime-smoke` | migration exit, HTTP statuses, restart count, heartbeat and outbox JSON report |
| Browser UAT | `pnpm p1:browser` | Playwright trace, screenshot/video on failure and request IDs captured in the manual sheet |
| Backup/restore | `pnpm p1:backup-restore` | `report.json`, redacted/synthetic dump only, MySQL invariant counts |
| Evidence integrity | `node scripts/p1/verify-release-evidence.mjs` | candidate identity plus SHA-256 manifest for passing runtime, browser and backup reports |

No MySQL suite may be skipped in the GitHub Actions release job. `RUN_MYSQL_E2E=1` is set only for a disposable database.

## Go / no-go record

The release manager completes `docs/P1_TEST_EVIDENCE.md` from CI artifacts and records:

1. candidate commit SHA, image digest and workflow URL;
2. each gate status and artifact path;
3. manual UAT request IDs, screenshots and database query result;
4. backup size/timings and restore report;
5. open P0/P1 defects, deferred scope and a signed decision.

**GO** requires every required row to pass, no open P0/P1 defect, and an evidence bundle tied to the candidate SHA. Otherwise the decision is **NO-GO**.

## Deferred after a GO

Real notification provider delivery, provider retry/timeout/429/500 handling, webhook deduplication, payment, full Professional verification/review, multi-region HA and monitoring SaaS remain deferred. P2 starts with the notification provider and its idempotency/retry/webhook proof.
