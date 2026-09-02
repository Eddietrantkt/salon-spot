# Professional identity database foundation - 28/08/2026

## Objective

Add the RFP-aligned persistence foundation for Professional profile verification, license/insurance metadata, private evidence and account password recovery without changing the working Core MVP booking policy.

## Decisions

- Password recovery belongs to `User`, so Professional, Owner and Admin identities use one recovery model.
- `ProfessionalProfile.status` remains the current booking capability (`ACTIVE`/`SUSPENDED`). `verificationStatus` is additive and is not enforced yet.
- A verification case is one submit/review cycle. Credentials are structured license/insurance claims. Documents are private evidence metadata; file bytes stay outside MySQL.
- Credential expiry is derived from `expiresAt`; no mutable `EXPIRED` flag is stored.
- Broad `AdminAccess` does not imply permission to review sensitive evidence. Review authority is represented by `AdminPermission(VERIFY_PROFESSIONAL)`.
- Existing profiles default to verification `DRAFT`; the migration never silently marks real accounts verified. The local demo seed explicitly creates an approved demo profile and credential metadata.

## Schema impact

- Extended `ProfessionalProfile` with `verificationStatus`.
- Added `ProfessionalVerificationCase`, `ProfessionalCredential`, `ProfessionalDocument`, `AdminPermission` and `PasswordResetToken`.
- Added composite foreign keys so evidence cannot reference a verification case belonging to another Professional.
- Added indexes for review queues, credential expiry, private-document state and active reset-token lookup.

## Compatibility boundary

This is an expand-only migration. Existing User, Owner, Admin, hold and Booking rows are not rewritten. `ProfessionalAccessService` still checks only `ProfessionalProfile.status`, so existing booking flows remain compatible. Verification-based eligibility must be introduced later through onboarding, manual review, legacy backfill and confirm-time transactional checks.

`PasswordResetToken` is persistence only. Request/confirm endpoints, email delivery, token generation and session-revocation behavior remain to be implemented and tested before calling password recovery complete.

## Remaining implementation

1. Professional profile and verification submit/resubmit interfaces.
2. Private upload/finalize/download storage implementation and document validation.
3. Admin review queue protected by `VERIFY_PROFESSIONAL`.
4. Password-reset request/confirm with a non-enumerating response and one-time token delivery.
5. Eligibility checks for new hold/confirm based on approved verification and credential validity through the target slot end.
6. UAT, migration/backfill runbook, retention policy and recovery tests before enforcement.
