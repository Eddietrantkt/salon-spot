# Vercel + Render + Aiven POC

## Scope

```text
Browser -> Vercel Vite web -> rewrite /api/* -> Render API (free)
                                              -> Aiven MySQL (TLS, free)
```

The Vercel rewrite deliberately keeps the browser URL under the Vercel origin.
The web client continues to call relative `/api/v1`; therefore the refresh
cookie is first-party rather than a cross-site API cookie.

## Repository artefacts

- `vercel.ts` builds the Vite web application from the monorepo root and fails
  closed until `RENDER_API_ORIGIN` is an HTTPS URL.
- `render.yaml` defines only the free Render API web service. `autoDeploy:
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
   before its process starts; stop if migration fails.
4. In Vercel, import the same GitHub repository with repository root as the
   Root Directory. Add `RENDER_API_ORIGIN=https://<render-api-host>` for
   Production and Preview. Deploy the project, then copy its Vercel URL.
5. Return to Render and set both `WEB_ORIGIN` and
   `MEDIA_PUBLIC_BASE_URL=https://<vercel-host>/api/v1`; redeploy API. Verify
   browser register/login/refresh/logout and a booking through the Vercel URL.

## Costs and POC limitations

- The Render API can use `free`, but it sleeps when idle. This $0 Blueprint
  intentionally omits the separate worker because Render does not offer a
  free Background Worker plan. Booking expiry, outbox processing and media
  cleanup therefore do not run reliably; this is a UI/API preview, not a
  complete workflow POC.
- `MEDIA_STORAGE_ROOT=/tmp/media` is ephemeral on Render. Uploads can vanish
  after a restart or redeploy. R2 requires the planned S3 media adapter and is
  intentionally not enabled here.
- Aiven Free is only 1 GB, 76 connections, can power off after inactivity, and
  has no SLA. It is valid only for a light POC.
- Do not put any real secret in Git, `render.yaml`, `vercel.ts`, or chat.
