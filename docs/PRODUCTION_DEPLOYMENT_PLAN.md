# Production deployment plan: Vercel web + VPS runtime

## Status and scope

This is an implementation plan for a single-instance public deployment. It is
not a declaration that the current UAT Compose stack is production-ready.
The Phase 1 release gate proves source, MySQL, browser, runtime-recovery and
backup/restore behaviour; production still needs owned infrastructure,
secrets, DNS and an operations decision.

Target topology:

```text
Browser
  -> https://app.<domain> (Vercel: apps/web)
  -> /api/v1/* rewrite
  -> https://api.<domain> (VPS: reverse proxy -> API)
                                      -> worker
                                      -> private MySQL
                                      -> S3-compatible media storage
```

Vercel hosts only the Vite web build. API, worker and MySQL remain on the
VPS; MySQL and the worker have no public port.

## Decisions the service owner must supply

| Decision | Required value | Why it cannot be guessed |
| --- | --- | --- |
| Public names | `app.<domain>` and `api.<domain>` | They drive DNS, HTTPS, `WEB_ORIGIN` and media URLs. |
| VPS | Provider, Ubuntu host and administrator access | This creates a billable, Internet-exposed system. |
| Object storage | S3-compatible provider, bucket and region | Local `/data/media` is not durable enough for public use. |
| Backup policy | retention, encryption, storage region, restore owner, RPO/RTO | The existing rehearsal is not an operational SLA. |
| Email/auth roadmap | provider and sender domain, or explicit deferral | The app has no real reset-email delivery or Google OAuth. |

## Provisioning stages

1. Create the VPS and DNS records. Expose only TCP 80/443. Keep 3306,
   API and worker ports private.
2. Install Docker Engine and Compose on the VPS. Create a non-root deploy
   account, a private runtime directory and an off-host backup destination.
3. Generate production-only values for `MYSQL_PASSWORD`,
   `MYSQL_ROOT_PASSWORD`, `JWT_ACCESS_SECRET`, `REFRESH_TOKEN_PEPPER` and
   `MEDIA_UPLOAD_SECRET`. Store them only in the VPS secret store or protected
   runtime environment file.
4. Create private MySQL and the media bucket. Run the API/worker with
   immutable image digests, then run `prisma migrate deploy` before admitting
   API or worker traffic.
5. Configure the VPS HTTPS proxy for `api.<domain>` and set:

   ```dotenv
   WEB_ORIGIN=https://app.<domain>
   MEDIA_PUBLIC_BASE_URL=https://api.<domain>/api/v1
   NODE_ENV=production
   ```

6. Configure Vercel with `apps/web` as the web root and a rewrite from
   `/api/v1/:path*` to `https://api.<domain>/api/v1/:path*`. The app keeps its
   relative `/api/v1` client contract, so refresh cookies remain same-origin
   from the browser's perspective. Do not commit a rewrite until the concrete
   API hostname is chosen.
7. Run production smoke: HTTPS redirect, `/api/v1/health/live`,
   `/api/v1/health/ready`, browser registration/login/refresh/logout, Owner
   and Admin authorization boundaries, booking hold/confirm/cancel, media
   upload, worker delivery and an off-host restore rehearsal.
8. Record deployed commit SHA/image digests, deployment timestamp, smoke
   request IDs and restore evidence. Roll back only to a compatible immutable
   image; Prisma migrations are forward-only.

## Required implementation work before public launch

- Replace the local-media adapter with S3-compatible object storage and a CDN
  policy; preserve the existing media contracts.
- Define and implement a production CSRF policy for cookie-authenticated
  writes, then test the Vercel rewrite deployment end-to-end.
- Choose and implement a transactional email provider for password reset and
  verification, or publish an explicit product decision that these flows are
  unavailable. Gmail addresses currently work only as email/password account
  identifiers; Google OAuth is not implemented.
- Add production monitoring/alerting and a documented incident owner. Compose
  restart policy does not repair host, disk, database or provider failures.
- Set backup retention, encryption, restore access, RPO and RTO before making
  any recovery SLA claim.

## Current verified boundary

The current candidate has a hosted CI-attested Phase 1 release gate. That is
evidence for the application candidate, not authorization to deploy it or
evidence that DNS, TLS, provider delivery, object storage, monitoring and
off-host production recovery have been configured.
