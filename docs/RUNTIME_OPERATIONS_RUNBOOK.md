# P0 runtime operations runbook

## Scope and boundary

This is the single-instance Docker Compose baseline for staging/UAT. It starts MySQL, a one-shot Prisma migration, the Nest API, the separate worker, and the static web reverse proxy. It is **not** production HA: Compose can restart a failed process, but it cannot repair a failed host, MySQL, disk, or storage service, and it has no external alerting.

The API, worker, and web use the same source build but are separate runtime processes. The worker has no published host port; its health endpoint is reachable only inside its container. Browser traffic goes through web at one origin, and nginx forwards `/api/*` to the API so refresh cookies remain same-origin.

## Prepare secrets

Copy `.env.runtime.example` to `.env.runtime` and replace every `replace-with-...` value with unique secrets. Keep `MYSQL_PASSWORD` and the password embedded in `DATABASE_URL` identical. The generated `.env.runtime` is ignored by Git and is the only file Compose uses for runtime configuration.

## Start and check

From the repository root, run:

```powershell
pnpm runtime:up
docker compose --project-name salon-spot-runtime --env-file .env.runtime -f compose.runtime.yaml ps
```

Expected order: MySQL becomes healthy, `migrate` exits successfully after `prisma migrate deploy`, then API and worker start, followed by web. Open `http://localhost:8080`. Health checks are:

```powershell
Invoke-WebRequest http://localhost:8080/api/v1/health/live
Invoke-WebRequest http://localhost:8080/api/v1/health/ready
docker compose --project-name salon-spot-runtime --env-file .env.runtime -f compose.runtime.yaml exec worker node -e "fetch('http://127.0.0.1:3001/worker/health/ready').then(r => { console.log(r.status); process.exit(r.ok ? 0 : 1) })"
```

`/health/live` means only that the API process is alive. `/health/ready` makes a bounded real Prisma/MySQL query. Worker ready means every scheduled job has completed a successful batch since its startup grace period and has not subsequently failed or become stale.

## Worker policy and stale response

The worker schedules hold expiry, booking lifecycle/outbox, and media cleanup every five seconds by default. Only a completed batch can record success. `WORKER_STALE_AFTER_SECONDS=30` is deliberately longer than the five-second cadence; the first 60 seconds are startup grace. A failed batch makes worker readiness fail, while a job with no successful batch through the stale threshold makes the watchdog log `watchdog_stale_exit` and exit with code 1. `restart: unless-stopped` then starts a fresh worker.

When Admin reports a stale heartbeat or the worker health check is not ready:

1. Inspect the structured worker logs: `docker compose --project-name salon-spot-runtime --env-file .env.runtime -f compose.runtime.yaml logs --tail=200 worker`.
2. Check MySQL/API readiness. Do not treat a crash loop caused by unavailable MySQL or disk as a worker-code recovery.
3. Confirm `docker compose ... ps` shows worker restarting/healthy and that each `WorkerHeartbeat.lastSucceededAt` advances.
4. Inspect old `PROCESSING` outbox rows only after their 60-second lease expires. A new worker conditionally reclaims them; never manually mark a row delivered merely to clear a dashboard warning.

For a controlled crash rehearsal, terminate the worker process from inside an isolated P1 stack (`pnpm p1:runtime-smoke`). Do not use `docker compose kill worker`: Docker treats it as a manual stop, so `unless-stopped` is not a valid restart-policy proof. A restart normally retains the container ID; record the ID, `RestartCount`, heartbeats and outbox state instead. The local notification sink and media cleanup transition outbox state using conditional leases. This proves one database delivery transition for the fixture; it does **not** prove exactly-once delivery to a future external provider across a crash after that provider accepts a request.

## Deploy, stop, and rollback

Deploy an updated build with `pnpm runtime:up`; Compose rebuilds and recreates changed services after the migration gate. Watch `migrate` before accepting the deployment. Stop the stack with `pnpm runtime:down`; add `--volumes` only when intentionally discarding the UAT database and media.

Rollback means redeploying the prior compatible image/source and its matching environment. Prisma migrations are forward-only in this baseline: do not run a down migration or erase the database as a rollback shortcut. If a migration is not backward compatible, stop and restore from the pre-deploy backup before continuing.

## Compose smoke evidence procedure

1. Use an isolated UAT host/volume, start with `pnpm runtime:up`, and confirm `migrate` succeeded and API/web/worker are healthy.
2. Create a valid booking through the documented API/browser flow. Confirm it creates its normal outbox event.
3. Create or retain a valid `PROCESSING` outbox event whose `availableAt` lease is expired, then terminate the worker process without manually stopping the container.
4. Confirm `RestartCount` advances, all three heartbeat timestamps advance, and the fixture becomes `DELIVERED` with one successful conditional claim.
5. Recheck API readiness and a web route through `http://localhost:8080`.

Record the container IDs/start times, HTTP statuses, migration output, heartbeat timestamps, outbox ID/status/attempt count, and test command output in the UAT evidence record. Alerting integration (Slack/PagerDuty) and a real provider retry sandbox are explicitly outside P0.
