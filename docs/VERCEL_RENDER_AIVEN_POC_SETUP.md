# Vercel + Render + Aiven POC

## Scope

```text
Browser -> Vercel Vite web -> rewrite /api/* -> Render API + worker (free POC)
                                              -> Aiven MySQL (TLS, free)
```

The Vercel rewrite deliberately keeps the browser URL under the Vercel origin.
The web client continues to call relative `/api/v1`; therefore the refresh
cookie is first-party rather than a cross-site API cookie.

## Repository artefacts

- `vercel.json` builds the Vite web application from the monorepo root, proxies
  `/api/*` to the Render API, and falls back to `index.html` for SPA deep links.
- `render.yaml` defines only the free Render API web service. The service runs
  the scheduled worker in-process with `RUN_WORKERS_IN_API=true`. `autoDeploy:
  false` prevents an import from deploying unreviewed commits.
- `infra/Dockerfile.render-api` is an API-specific image because Render builds
  a Dockerfile's final stage and the existing Compose Dockerfile defaults to
  the web nginx image.

## Create the services

1. In Aiven, create a MySQL Free service, then create the `salon_spot`
   database/user. Copy the connection URI from Connection information. Aiven
   protects its service traffic with TLS; use the console URI/CA instructions
   exactly as displayed for that service.
2. In Render, choose **New > Blueprint**, select the GitHub repository, and
   review `render.yaml`. Enter every `sync: false` variable in the dashboard:
   `DATABASE_URL`, `JWT_ACCESS_SECRET`, `REFRESH_TOKEN_PEPPER`,
   `MEDIA_UPLOAD_SECRET`, `WEB_ORIGIN`, and `MEDIA_PUBLIC_BASE_URL`.
3. Deploy the API first. Copy its public HTTPS URL. The API migration runs
   before its process starts; stop if migration fails. For the isolated POC
   database only, open a Render Shell and run `node apps/api/dist/scripts/seed-demo.js`.
   This resets only the named `demo_*` fixture records and must never be run on
   a database containing real user data. Before continuing, confirm that
   `/api/v1/workspaces?area=D1&date=<tomorrow-in-Asia/Ho_Chi_Minh>` returns at
   least one workspace.
4. In Vercel, import the same GitHub repository with repository root as the
   Root Directory. Deploy the project, then copy its Vercel URL.
5. Return to Render and set both `WEB_ORIGIN` and
   `MEDIA_PUBLIC_BASE_URL=https://<vercel-host>/api/v1`; redeploy API. Verify
   browser register/login/refresh/logout and a booking through the Vercel URL.

## Worker mode

The hosted POC enables `RUN_WORKERS_IN_API=true`. This starts hold expiry,
booking lifecycle, notification outbox delivery and media cleanup in the same
Node process as the HTTP API. It is an explicit workaround for the Render Free
plan, which does not provide a free Background Worker service.

The local/runtime Compose baseline remains the reference separation: API and
worker use separate processes and the worker has its own readiness endpoint.
Do not enable both modes against the same database, or two job loops will run
at once. Lease/idempotency rules reduce duplicate delivery risk but do not make
duplicate schedulers the preferred production topology.

## Costs and POC limitations

- The Render API can use `free`, but it sleeps when idle. Co-locating the worker
  makes outbox processing available while the service is running, but sleep,
  restarts and shared CPU/memory still apply. This remains a UI/workflow POC,
  not an always-on or production-ready deployment.
- `MEDIA_STORAGE_ROOT=/tmp/media` is ephemeral on Render. Uploads can vanish
  after a restart or redeploy. R2 requires the planned S3 media adapter and is
  intentionally not enabled here.
- Aiven Free is only 1 GB, 76 connections, can power off after inactivity, and
  has no SLA. It is valid only for a light POC.
- Do not put any real secret in Git, `render.yaml`, `vercel.ts`, or chat.
