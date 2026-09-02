# Identity and access contract

## HTTP interfaces

| Endpoint | Purpose |
| --- | --- |
| `POST /api/v1/auth/register` | Create an account, initial refresh session and audit event. |
| `POST /api/v1/auth/login` | Verify password and issue a new session. |
| `POST /api/v1/auth/refresh` | Rotate a valid refresh token. Reuse of an old token revokes its active session family. |
| `POST /api/v1/auth/logout` | Revoke one refresh session. Safe to retry. |
| `GET /api/v1/auth/me` | Return the current user when the request has a valid `Authorization: Bearer <access-token>` header. |

`register`, `login` and `refresh` return the same `AuthenticationResponse`: public user profile, short-lived access token and opaque refresh token with expiry timestamps. The web uses the HttpOnly refresh cookie to restore its in-memory access token after reload. Production CSRF hardening remains a separate deployment/security decision.

## Security and ownership rules

- Passwords use per-password salt and Node.js `scrypt`; raw passwords are never persisted.
- Refresh tokens are random opaque values. The database stores only an HMAC-SHA256 hash using `REFRESH_TOKEN_PEPPER`.
- Every refresh rotation revokes the old token. Reusing an already revoked refresh token revokes the active token family.
- `JWT_ACCESS_SECRET` and `REFRESH_TOKEN_PEPPER` are required at startup and must be distinct, non-placeholder secrets with at least 32 characters.
- `RequestIdMiddleware` runs before guards. Every HTTP response, including a 401/403 denial, returns `x-request-id` and the shared error-body `requestId`; CORS exposes the header to the web client.
- `SalonMembershipAuthorizer` is the BOLA seam. Owner routes use `AccessTokenGuard` followed by `SalonOwnerGuard` and expose `:salonId`.
- `ProfessionalProfile` is a 1:0..1 User extension. `ProfessionalGuard` plus service-level checks require status `ACTIVE` for hold, confirm, own-booking read and cancel. Owner and Admin capabilities are independent; a multi-role user needs an explicit Professional profile to book.
- For local/UAT operations, `pnpm --filter @salon-spot/api professional:grant -- person@example.com` activates or restores the profile and writes an audit event. It requires a pre-registered account and is not a public self-service API.
- Professional trust data is additive: `ProfessionalVerificationCase` records one review cycle, `ProfessionalCredential` holds structured license/insurance validity, and `ProfessionalDocument` holds private evidence metadata. Existing booking authorization does not consume these fields yet.
- `AdminPermission(VERIFY_PROFESSIONAL)` is separate from broad `AdminAccess`; future review endpoints must require the narrow permission.
- `PasswordResetToken` belongs to `User`, not a role. It stores only a one-time token hash and supports future recovery for Professional, Owner and Admin accounts through the same Auth module.

## Intentional limits

Password-reset HTTP/email delivery, rate limiting, production CSRF policy and public Professional onboarding/approval remain unimplemented. Database persistence for reset tokens and Professional verification exists, but must not be presented as a completed user workflow. Admin authorization, Owner supply and current Professional booking access remain implemented separately.
