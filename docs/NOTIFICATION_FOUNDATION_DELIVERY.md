# Notification Foundation Delivery

Status date: 2026-09-08
Scope: Sprint 1 of `PLAN_COMMUNICATION_REVIEWS_ADMIN.md`

## Implemented

- Additive MySQL schema and migration for `Notification`, `NotificationPreference`, and `NotificationDelivery`.
- Booking events `BOOKING_CONFIRMED`, `BOOKING_CANCELLED`, and `BOOKING_COMPLETED` materialize one in-app notification per active Professional/Owner recipient.
- Unique database key `(sourceEventId, recipientUserId, type)` prevents duplicate inbox items.
- The notification worker owns recipient resolution, inbox materialization, IN_APP delivery state, outbox lease completion, and bounded exponential retry after the booking transaction commits.
- Authenticated inbox endpoints support pagination, read/unread filtering, unread count, mark-one-read, mark-all-read, and persisted preferences.
- Notification mutations require `Idempotency-Key`; recipient ownership is enforced by the database query, returning not-found for cross-user IDs.
- The web exposes `/notifications`, a navigation unread count, EN/VI copy, read controls, filters, paginated loading, exact booking navigation, and preference controls.
- Exact booking detail is readable by the booking Professional and active members of its Salon; only the Professional receives cancellation controls.
- Worker readiness/heartbeat now includes `notification-delivery` independently from booking lifecycle.

## Interfaces

- `GET /api/v1/me/notifications?status=read|unread&page=&pageSize=`
- `GET /api/v1/me/notifications/unread-count`
- `PUT /api/v1/me/notifications/:notificationId/read`
- `PUT /api/v1/me/notifications/read-all`
- `GET /api/v1/me/notification-preferences`
- `PATCH /api/v1/me/notification-preferences`

## Verification evidence

- Prisma Client generation: PASS.
- Fresh disposable MySQL 8.4: all 9 migrations applied, including `20260908100000_notification_foundation`.
- Required MySQL gate: 4 suites, 16 tests PASS. This includes database duplicate protection and lease/retry materialization.
- API default suite: 45 suites PASS, 119 tests PASS, 5 opt-in MySQL suites skipped by design.
- Notification/worker focused suites: 5 suites, 8 tests PASS.
- Web tests: 15/15 PASS.
- API and web typecheck: PASS.
- API build and web production build: PASS.

The first combined disposable-MySQL run exposed a pre-existing transient media-cap race (9 rather than 10 successful intents), followed by a closed Prisma connection. The availability suite passed 9/9 in isolation and the complete four-suite MySQL gate then passed 16/16 on rerun. This is recorded as transient evidence, not silently treated as a clean first-pass gate.

After the pagination and exact-booking fixes, the expanded disposable-MySQL gate passed 5 suites / 22 tests. Local browser QA passed 7 checks with 51 notifications and a persisted booking target.

## Explicitly deferred

- Real email provider, provider message IDs, email retry/dead-letter operations, and template rendering.
- Push notifications.
- Chat/conversation/message/report workflows.
- Reviews, rating aggregates, review reports, and trust badges.
- Private verification upload/review enforcement.
- Expanded Admin RBAC, moderation, support, analytics, and notification retry screens.
- Packaged-runtime recovery evidence for this changed candidate.

The full Communication/Reviews/Trust/Admin plan is therefore not complete. This delivery establishes only the first dependency-safe vertical slice and does not claim production readiness.
