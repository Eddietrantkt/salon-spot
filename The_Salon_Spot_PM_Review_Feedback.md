# The Salon Spot — PM Review Feedback

**Source reviewed:** `The_Salon_Spot_Backend_Technical_Baseline_Overview_Aligned.docx`  
**Review perspective:** Project Manager / Delivery / Product Readiness  
**Purpose:** Identify gaps, project risks, business decisions, delivery gates, and required corrections before treating the backend baseline as implementation-ready.

---

## 1. Executive Summary

The current backend technical baseline is strong from an engineering perspective.

The main architecture decisions are appropriate for an MVP:

- NestJS + TypeScript
- PostgreSQL + Prisma
- REST API
- Modular Monolith
- Workspace-first inventory
- Instant Booking
- Capacity = 1 for Phase 1
- PostgreSQL constraints for inventory correctness
- Transactional booking/payment lifecycle
- Object-level authorization through SalonMembership
- Webhook deduplication, idempotency, reconciliation, and outbox patterns
- PostgreSQL-based concurrency testing

From a PM perspective, the main project risk is **not architecture**.

The major remaining risk is that several business decisions on the critical path are still assumptions or open policies. If development proceeds without freezing them, the project is exposed to:

- backend rework;
- frontend flow changes;
- database migration changes;
- inconsistent interpretation between BA, PM, FE, BE, QA, and client;
- UAT rejection;
- payment flow redesign;
- scope creep near release.

### PM Overall Assessment

| Area | Assessment |
|---|---:|
| Product direction | 8/10 |
| MVP scope clarity | 7/10 |
| Backend architecture | 9/10 |
| Database / concurrency design | 9/10 |
| Business flow completeness | 6.5/10 |
| Roles & authorization | 7.5/10 |
| Payment readiness | 6/10 |
| Testing strategy | 9/10 |
| UAT readiness | 6/10 |
| Delivery readiness | 7/10 |
| Overall | ~7.5–8/10 |

**Conclusion:** The document is a good technical baseline, but it should not yet be treated as the final end-to-end implementation baseline.

---

# 2. PM Recommendation: Add a Decision Register

The current document correctly distinguishes assumptions from hard invariants, but from a delivery perspective each unresolved decision should have:

- an ID;
- decision description;
- status;
- owner;
- deadline;
- impacted phase;
- whether it blocks implementation.

Recommended structure:

| ID | Decision | Status | Blocks | Owner |
|---|---|---|---|---|
| D01 | Workspace is the bookable unit | DECIDED | Domain | Product |
| D02 | Instant Booking | DECIDED / Client Approval Required | Booking | Product |
| D03 | Capacity = 1 in Phase 1 | DECIDED | Availability | Product + Tech |
| D04 | Rental duration / Availability model | OPEN P0 | Availability, Booking | Product |
| D05 | Deposit model | OPEN P0 | Checkout | Business / Finance |
| D06 | Merchant of Record | OPEN P0 | Payment | Business / Finance |
| D07 | Remaining balance collection | OPEN P0 | Checkout / Payment | Business |
| D08 | Cancellation cutoff and refund rules | OPEN P0 | Booking / Refund | Product / Finance |
| D09 | Payout timing and ownership | OPEN P0 | Payout | Finance |
| D10 | Partial refunds | DEFERRED | — | — |
| D11 | Multi-capacity inventory | DEFERRED | — | — |
| D12 | Native mobile apps | DEFERRED | — | — |

### PM Rule

Any decision marked **OPEN P0** must state exactly which implementation phase it blocks.

---

# 3. P0 — Availability and Rental Option Model Must Be Frozen

This is the most important unresolved design decision.

The baseline currently defines:

```text
Workspace
  -> RentalOption
  -> AvailabilitySlot
```

A RentalOption may contain:

```text
duration_minutes
price
currency
```

At the same time, AvailabilitySlot is modeled as a predefined, non-overlapping interval.

This creates an important business question.

Example:

```text
Workspace available: 09:00–13:00

Rental options:
- 30 minutes
- 60 minutes
- 120 minutes
```

Can a Professional book:

```text
10:30–12:30
```

or must the system expose fixed predefined slots?

## Option A — Fixed Predefined Slots

Example:

```text
09:00–10:00
10:00–11:00
11:00–12:00
12:00–13:00
```

Advantages:

- matches the current SlotHold design;
- simpler concurrency;
- simpler checkout;
- works well with the PostgreSQL exclusion constraint;
- lower MVP complexity.

## Option B — Availability Period + Runtime Allocation

Owner defines:

```text
OPEN: 09:00–13:00
```

Professional chooses:

```text
start = 10:30
duration = 120 minutes
```

This requires a more complex allocation model and changes the current slot design.

### PM Feedback

**Severity: P0 BLOCKER**

Before the Availability phase begins, the product must explicitly approve one model.

The document should add a dedicated section:

> Booking Unit & Rental Duration Policy

with real business examples.

---

# 4. Instant Booking Must Be Treated as a Product Decision

The baseline currently assumes:

```text
Availability verified
+ Payment verified
= Booking CONFIRMED
```

There is no manual Owner approval step.

This is a major product decision, not a minor implementation detail.

If the client later requests:

```text
Professional requests booking
-> Owner approves
-> Payment/booking confirmed
```

then the following areas change:

- booking states;
- payment timing;
- hold duration;
- availability lifecycle;
- Owner dashboard;
- notifications;
- expiry behavior;
- cancellation;
- UAT flows.

### PM Feedback

The document should explicitly mark:

> **Instant Booking — Phase 1 Product Decision**

with one of:

- APPROVED;
- CLIENT APPROVAL REQUIRED;
- OPEN P0.

Development should not silently assume this is permanent if it has not been formally agreed.

---

# 5. Owner / Manager Lifecycle Is Incomplete

The technical authorization direction is good:

```text
SalonMembership
```

provides object-level scope for Owner/Manager access.

However, the business lifecycle for Manager is not defined.

Questions still unresolved:

- Who creates a Salon?
- Does the creator automatically become Owner?
- How is a Manager added?
- Does the Manager need an existing account?
- Is an email invitation required?
- Can an invitation expire?
- Can an Owner revoke an invitation?
- Can a Manager be removed?
- Can a Salon have multiple Owners?
- Can ownership be transferred?

A possible lifecycle:

```text
OWNER
  -> Invite Manager
  -> PENDING invitation
  -> Manager accepts
  -> ACTIVE membership
```

### PM Recommendation

Choose one:

#### Option A — Manager Included in Phase 1

Add the following to scope:

- invite manager;
- accept invitation;
- revoke invitation;
- remove manager;
- membership status;
- permission checks.

#### Option B — Manager Deferred

Keep only Owner management in Phase 1 and explicitly move Manager lifecycle to Deferred.

Do not leave a Manager role in the sitemap without a complete business flow.

---

# 6. Salon Ownership Has Two Potential Sources of Truth

The current model includes both:

```text
Salon.owner_user_id
```

and:

```text
SalonMembership
  role = OWNER / MANAGER
```

The document also states that SalonMembership is the source of authorization scope.

From a PM perspective, this creates a business ambiguity.

Example:

```text
Salon.owner_user_id = User A

SalonMembership:
User A = MANAGER
User B = OWNER
```

Who is the actual owner?

### PM Recommendation

Use one authoritative business rule.

Preferred direction:

```text
SalonMembership = authorization source of truth
```

When a Salon is created:

```text
Create Salon
-> Create SalonMembership for creator as OWNER
```

If `owner_user_id` is kept, it must have a clearly defined business meaning such as:

```text
primary_owner_user_id
```

and a database/application invariant must keep it aligned.

If no separate primary owner concept is required, remove the duplicate field.

---

# 7. Payment Is the Largest Delivery Risk After Availability

The technical payment baseline is strong.

It already includes:

- verified webhooks;
- webhook signature verification;
- ProviderInbox;
- event deduplication;
- idempotency;
- reconciliation;
- late-payment handling;
- refund records;
- outbox;
- retry behavior.

However, the commercial payment model is still not fully frozen.

The following questions must be answered before Payment is considered implementation-ready.

| Question | Priority |
|---|---|
| Deposit or full payment? | P0 |
| Deposit amount / percentage? | P0 |
| Fixed or configurable deposit? | P0 |
| Who is Merchant of Record? | P0 |
| Who receives the initial payment? | P0 |
| When is the Salon paid? | P0 |
| How is the remaining balance collected? | P0 |
| Who handles refund liability? | P0 |
| What happens when Owner cancels? | P0 |
| What happens when Professional cancels? | P0 |
| Are provider fees refundable? | P1 |
| Is platform commission charged? | P0/P1 |
| Who issues receipt/invoice? | P1 |
| How are taxes handled? | P1 |

### PM Feedback

Payment development should have a dedicated decision gate.

Do not let backend engineers infer financial rules from implementation convenience.

---

# 8. Payout Scope Is Ambiguous

The Owner sitemap includes:

```text
Payout / Profile
```

while the Deferred section states that a complex payout engine is outside MVP scope.

These statements are not necessarily contradictory, but the expected Phase 1 outcome is unclear.

## Possible Phase 1 Scope

```text
Connect payout account
View payout status
View provider payout history
```

while the payment provider manages actual settlement.

## Out-of-Scope Example

```text
Internal balance ledger
Platform settlement engine
Manual payout
Payout scheduling
Complex reconciliation dashboard
```

### PM Feedback

Rename or define the sitemap item clearly.

For example:

```text
Payout Account
Payout History
```

instead of a broad `Payout` module.

If there is no payout UI in MVP, remove it from the Phase 1 sitemap.

---

# 9. Cancellation Needs a Business Policy Matrix

The current technical cancellation flow is good:

```text
CONFIRMED
-> CANCELLED
-> release slot if eligible
-> create Refund record
```

However, the actual business policy is not yet defined.

Recommended matrix:

| Actor | Timing | Cancellation Allowed | Refund | Slot |
|---|---|---:|---|---|
| Professional | > cutoff | Yes | Full / policy | Re-open |
| Professional | <= cutoff | Yes/No | None / policy | Define |
| Owner | Before booking | Yes | Full | Re-open |
| Admin | Exception | Policy | Policy | Depends |
| System | Payment expiry | Automatic | No successful charge | Re-open |

Questions that need business approval:

- What is the cancellation cutoff?
- Is it based on hours or days?
- Which timezone is used?
- Can Owner cancel at any time?
- Is a cancellation reason mandatory?
- Is Owner cancellation always fully refunded?
- Can Admin override the rule?
- What happens to provider fees?
- What happens if payment succeeds after expiry?

### PM Feedback

Do not hard-code `24h`, `48h`, or any other cutoff until Business approves it.

---

# 10. Reschedule Must Be Either Included or Deferred

The baseline currently mentions:

```text
reschedule request (if enabled)
```

From a PM perspective, “if enabled” is not an acceptable final scope status.

Reschedule impacts:

- availability;
- pricing;
- slot locking;
- deposits;
- additional charges/refunds;
- notifications;
- audit;
- booking history.

### PM Recommendation

For MVP:

> **Defer Reschedule**

Professional can:

```text
Cancel
-> Book a new slot
```

unless the client has explicitly required rescheduling.

---

# 11. Search / Discovery Needs a Clear MVP Contract

Search is part of the P0 Professional journey, but the technical API boundary is still broad.

The PM/BA team should freeze the minimum search feature set.

Recommended decision matrix:

| Search capability | MVP |
|---|---|
| Search by location | Yes |
| Search by date | Yes |
| Search only available Workspace | Yes |
| Rental duration filter | Yes |
| Price range | Yes / Confirm |
| Amenities | Yes / Confirm |
| Distance | Confirm |
| Sort by price | Confirm |
| Sort by distance | Confirm |
| Rating | Deferred unless Reviews exist |
| Recommendation ranking | Deferred |

If “near me” or distance search is required, the Salon schema should support appropriate location data rather than relying only on an address string.

### PM Feedback

Search should be specified before FE implementation, otherwise UI and API contracts may drift.

---

# 12. Transactional Notifications Must Be in MVP

The document correctly defers an advanced Notification Center.

However, this must not be interpreted as:

> no notifications in Phase 1.

MVP still requires transactional communications such as:

- forgot-password email;
- booking confirmation;
- booking cancellation;
- payment failure;
- refund completion;
- Manager invitation if Manager is in scope.

### Recommended MVP

```text
OutboxEvent
  -> Notification worker
  -> Email provider
```

No need for:

- full Notification Center;
- push notification;
- advanced preferences;
- Kafka;
- realtime notification infrastructure.

### PM Feedback

Add a clear distinction:

**Required:** Transactional Notifications  
**Deferred:** Advanced Notification Center

---

# 13. License Business Rules Are Not Defined

The technical license storage design is good:

- private object storage;
- signed URL;
- checksum;
- size/content validation;
- expiry date;
- authorization.

But the product meaning of License is not yet clear.

Possible states:

```text
MISSING
PENDING
VERIFIED
REJECTED
EXPIRED
```

The project must define what these states affect.

Example matrix:

| Action | Missing | Pending | Verified | Expired |
|---|---:|---:|---:|---:|
| Login | Yes | Yes | Yes | Yes |
| Search | Yes | Yes | Yes | Yes |
| Message | TBD | TBD | Yes | TBD |
| Booking | TBD | TBD | Yes | TBD |

### PM Recommendation

Choose one Phase 1 policy.

#### Simple MVP

> License is informational only and does not block booking.

or:

#### Compliance MVP

> Only VERIFIED license holders can create a Booking.

Do not leave this decision implicit.

---

# 14. Chat Scope Must Be Frozen

Chat is correctly isolated from Booking/Payment state transitions.

However, “Chat” can expand very quickly unless its MVP Definition of Done is explicit.

Recommended MVP scope:

```text
1-to-1 conversation
Text only
Booking / Workspace context
Message history
Read / unread state
Pagination
Participant authorization
```

Recommended Deferred:

```text
Image attachment
File attachment
Voice
Video
Group chat
Advanced moderation
Typing indicator
Complex realtime presence
```

Realtime WebSocket should be treated as a separate technical/product decision.

---

# 15. Admin Scope Is Too Broad

The current concept:

```text
Inspect / Recovery / Audit
```

is directionally correct but is not enough for backlog estimation.

Recommended Admin capability matrix:

| Capability | Phase 1 |
|---|---:|
| Search/View User | Yes |
| Search/View Salon | Yes |
| Search/View Workspace | Yes |
| View Booking | Yes |
| View Payment | Yes |
| View Refund | Yes |
| View Audit events | Yes |
| Disable User | Confirm |
| Disable Workspace | Confirm |
| Cancel Booking | Confirm |
| Trigger Refund | Confirm |
| Retry reconciliation | Confirm |
| Directly overwrite Booking status | No |
| Directly overwrite Payment status | No |

### PM Feedback

Avoid building an “Admin can edit everything” system.

Any recovery action should require:

- explicit command;
- authorization;
- reason;
- append-only AuditEvent;
- idempotency where applicable.

---

# 16. Booking COMPLETED State Needs a Defined Trigger

The state model contains:

```text
CONFIRMED
-> COMPLETED
```

but the trigger is not clearly defined.

Two possible business models:

## Option A — Automatic

```text
ends_at < current time
-> worker marks COMPLETED
```

## Option B — Manual Completion

```text
Owner or Professional confirms service completed
```

Option B introduces additional flows such as check-in, no-show, dispute, and manual confirmation.

### PM Recommendation

For Phase 1, use automatic completion unless a manual attendance/check-in requirement exists.

---

# 17. Owner Cancellation Must Be a Separate Business Flow

Professional and Owner cancellations should not automatically share identical rules.

Recommended Owner cancellation flow:

```text
Owner cancels
-> reason required
-> Booking CANCELLED
-> full refund according to policy
-> future Slot re-opened
-> Professional notified
-> AuditEvent created
```

Potential future policies:

- Owner cancellation penalty;
- cancellation rate;
- temporary listing suspension;
- ranking impact.

These can be Deferred, but the basic Phase 1 rule must be explicit.

---

# 18. Transactional Idempotency Needs a Clear Persistence Model

The document states that retryable writes should persist:

- Idempotency-Key;
- actor;
- route/scope;
- request fingerprint;
- response reference.

However, the database catalog does not define a common persistence model.

Recommended entity:

```text
IdempotencyRecord

id
actor_user_id
scope
idempotency_key
request_fingerprint
resource_type
resource_id
response_status
created_at
expires_at
```

Recommended uniqueness:

```text
UNIQUE(actor_user_id, scope, idempotency_key)
```

### PM Impact

Without a common rule, Checkout, Cancel, Refund, and other retryable actions may implement idempotency differently, increasing QA and production risk.

---

# 19. Payment Must Prevent Double Successful Deposit

A Booking can have multiple Payment records, which is useful for payment attempts and history.

However, Phase 1 states that only one deposit charge is supported.

Therefore, the system must prevent this state:

```text
Booking A
  Payment 1 -> SUCCEEDED
  Payment 2 -> SUCCEEDED
```

even if the two payments have different provider references.

### PM Feedback

Add a business/database invariant ensuring one successful Phase 1 deposit per Booking.

Payment attempts may be multiple; successful payable outcome must remain unique according to the Phase 1 payment model.

---

# 20. Database Composite FK for RentalOption Needs Correction

The design intends to guarantee:

```text
AvailabilitySlot.rental_option_id
```

belongs to the same Workspace as:

```text
AvailabilitySlot.workspace_id
```

If the migration uses:

```sql
FOREIGN KEY (rental_option_id, workspace_id)
REFERENCES workspace_rental_options(id, workspace_id)
```

the referenced table must also have an appropriate unique key, for example:

```sql
UNIQUE (id, workspace_id)
```

The current specification mainly states:

```text
UNIQUE(workspace_id, code)
```

which does not satisfy that composite FK target.

### PM Feedback

This should be corrected in the schema baseline before migration implementation.

---

# 21. Salon Photos Are in the Sitemap but Not Fully Reflected in the Data Model

The Owner sitemap includes Salon photos.

The data catalog clearly defines Workspace images but does not equally define Salon media.

Recommended implementation:

```text
SalonMedia
WorkspaceMedia
```

or two separate media tables.

A separate Media business module is not required.

### PM Feedback

Ensure sitemap features and DB scope are traceable so that UI requirements do not appear late during implementation.

---

# 22. Booking Snapshot Timing Should Be Unified

The document sometimes describes Booking snapshot creation at checkout, while another section references some snapshot fields at confirmation.

This should be standardized.

Recommended rule:

## Freeze at Checkout

```text
Salon display snapshot
Workspace display snapshot
Rental option
Price
Currency
Deposit due
starts_at
ends_at
timezone
```

## Confirmation Adds

```text
confirmed_at
verified Payment reference
```

This makes retry/webhook/reconciliation behavior easier to reason about.

---

# 23. Availability BLOCKED Lifecycle Needs More Detail

Recommended rules:

```text
OPEN
-> editable

HELD
-> locked from Owner edits

BOOKED
-> immutable

BLOCKED
-> can be unblocked if future and allowed

Past slot
-> historical / immutable
```

The document should explicitly define:

- create block;
- unblock;
- delete future OPEN slot;
- edit future OPEN slot;
- behavior when a hold exists;
- behavior when a booking exists.

---

# 24. API Contract Needs Delivery-Level Conventions

Before FE and BE work independently, define:

```text
/api/v1
```

and standardized conventions for:

- pagination;
- filtering;
- sorting;
- error response;
- requestId;
- Idempotency-Key;
- date/time format;
- money format;
- status enum;
- OpenAPI / Swagger generation.

Example:

```http
GET /api/v1/workspaces?page=1&pageSize=20
GET /api/v1/bookings?status=CONFIRMED
```

Example response:

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 100
  }
}
```

This reduces FE/BE contract drift.

---

# 25. Technical Tests Are Strong, but Business UAT Criteria Are Missing

The current testing strategy is one of the strongest sections.

It correctly includes:

- unit tests;
- integration tests;
- real PostgreSQL tests;
- concurrency races;
- migration tests;
- security/BOLA tests;
- E2E P0 journeys.

However, these prove mainly technical correctness.

The project also needs Business UAT acceptance criteria.

Example:

## Journey — Professional Booking

### Given

```text
Workspace is published
AvailabilitySlot is OPEN
Professional is eligible to book
```

### When

```text
Professional selects the slot
Professional completes a successful payment
```

### Then

```text
Booking appears under Upcoming
Owner sees the Booking
Slot is unavailable to other Professionals
Correct deposit is shown
Booking confirmation is sent
Price/time snapshot is preserved
Payment appears in the Booking history
```

PM should maintain both:

```text
Technical Acceptance
+
Business UAT Acceptance
```

---

# 26. Non-Functional Requirements Need Measurable Launch Targets

The technical baseline mentions logging, worker monitoring, configuration validation, migration workflow, and runbooks.

Before production, PM should also obtain agreed launch targets for:

- expected users;
- expected Salons;
- expected Workspaces;
- peak checkout concurrency;
- search response target;
- booking response target;
- backup frequency;
- RPO;
- RTO;
- monitoring owner;
- incident owner;
- alert recipients.

Do not invent enterprise-level SLAs if the client does not need them.

The important point is that production readiness must become testable.

---

# 27. Privacy and Data Retention Need a Business Policy

The document correctly avoids hard-deleting historical Booking/Payment/Audit records and references anonymization/retention.

The project still needs decisions for:

```text
User account deletion
Professional profile
License documents
Bookings
Payments
Refunds
Chat
Audit events
Provider webhook data
```

Questions include:

- what is deleted;
- what is anonymized;
- what is retained;
- retention period;
- who can access retained data;
- when private license documents are removed.

This should be finalized before production readiness review.

---

# 28. Recommended Delivery Gates

## Gate A — Before Availability Implementation

Must freeze:

- fixed slot vs runtime duration allocation;
- RentalOption semantics;
- Availability generation;
- timezone behavior;
- overlap rules.

**No approval -> do not implement Availability deeply.**

---

## Gate B — Before Payment Implementation

Must freeze:

- deposit model;
- merchant-of-record;
- platform fee;
- cancellation/refund;
- remaining balance;
- payout model;
- payment provider;
- late-payment policy.

**No approval -> payment skeleton only, not production-complete payment.**

---

## Gate C — Before UAT

Must freeze:

- notification requirements;
- license gating;
- Admin capabilities;
- data retention;
- operational targets;
- backup/recovery;
- support ownership.

---

# 29. Recommended Development Phases

## Phase 0 — Decision & Architecture Freeze

### Scope

- Decision Register
- domain terminology
- state machine
- availability model
- payment assumptions
- cancellation policy
- role/membership policy
- API contract baseline

### Exit Criteria

- all P0 decisions approved;
- no unresolved decision blocking Phase 1–5;
- ADRs created for non-obvious architecture decisions.

---

## Phase 1 — Foundation & Authentication

### Scope

- NestJS scaffold
- PostgreSQL / Prisma
- migrations
- configuration
- requestId
- logging
- error format
- Auth
- User
- ProfessionalProfile
- AuthSession
- password reset
- SalonMembership authorization foundation

### Exit Criteria

- authentication tests pass;
- refresh rotation works;
- BOLA baseline passes;
- migration pipeline works.

---

## Phase 2 — Supply Management

### Scope

- Salon
- Workspace
- RentalOption
- Salon media
- Workspace media
- amenities
- publish lifecycle
- ownership checks

### Exit Criteria

Owner can create and publish a complete, discoverable Workspace.

---

## Phase 3 — Discovery & Availability

### Scope

- Search
- filters
- availability creation
- blocked periods
- slot generation/allocation
- hold
- expiry
- concurrency protection

### Exit Criteria

- no overlapping inventory;
- one active hold per slot;
- search exposes only valid supply;
- real PostgreSQL race tests pass.

---

## Phase 4 — Booking

### Scope

- checkout intent
- PENDING_PAYMENT
- snapshots
- idempotency
- expiry
- CONFIRMED
- cancellation
- COMPLETED
- booking history

### Exit Criteria

Booking lifecycle passes integration, concurrency, and business acceptance tests.

---

## Phase 5 — Payment / Refund / Reconciliation

### Scope

- payment provider
- webhook signature
- ProviderInbox
- successful deposit
- refund
- reconciliation
- late payment
- outbox
- payout integration if in scope

### Exit Criteria

Full financial E2E flow passes, including provider retry and failure recovery.

---

## Phase 6 — Notifications / Chat / Admin

### Scope

- transactional email
- Chat MVP
- Admin inspect/recovery
- audit completion
- operational workflows

### Exit Criteria

Operational support journeys are testable end-to-end.

---

## Phase 7 — UAT & Hardening

### Scope

- business UAT
- security
- concurrency
- regression
- performance
- timezone
- mobile PWA smoke
- failure scenarios

### Exit Criteria

All P0 journeys accepted by Product/Business.

---

## Phase 8 — Production Readiness & Launch

### Scope

- migration rehearsal
- backup/restore
- monitoring
- alerting
- runbooks
- reconciliation runbook
- production smoke
- release checklist

### Exit Criteria

Go-live checklist approved by PM, Tech, QA, and Business owners.

---

# 30. Priority Summary

## P0 — Must Resolve Before Deep Implementation

1. Availability / RentalOption model
2. Instant Booking approval
3. Owner / SalonMembership source of truth
4. Manager lifecycle
5. Deposit/payment business model
6. Merchant-of-record
7. Remaining balance
8. Cancellation/refund rules
9. Payout Phase 1 scope

---

## P1 — Resolve Before Booking/Payment Production Readiness

1. Transactional notifications
2. Search contract
3. Generic idempotency persistence
4. Double successful payment invariant
5. Salon media
6. Booking COMPLETED rule
7. Owner cancellation
8. Availability blocked/unblocked rules
9. Snapshot timing
10. API versioning/pagination/OpenAPI

---

## P2 — Complete Before Final UAT / Launch

1. License business state
2. Chat exact MVP scope
3. Admin recovery capability matrix
4. Data retention
5. Non-functional targets
6. Operational ownership
7. Documentation numbering / editorial cleanup

---

# 31. What Should NOT Be Changed

The current project does **not** need a major architecture rewrite.

Keep:

```text
NestJS
TypeScript
PostgreSQL
Prisma
REST
Modular Monolith
Workspace-first inventory
Capacity = 1 for Phase 1
SlotHold
Payment verified webhook
SalonMembership object scope
PostgreSQL constraints
Outbox / ProviderInbox
Idempotency
Real PostgreSQL concurrency tests
Immutable Booking history
```

Do not add complexity only for architectural appearance.

Avoid introducing without clear evidence:

```text
Microservices
Kafka
CQRS
Event Sourcing
Elasticsearch
Kubernetes
Repository-per-entity abstraction
Distributed event infrastructure
```

The current project risk is business ambiguity, not insufficient architecture complexity.

---

# 32. Final PM Feedback

The Salon Spot backend baseline is already a strong technical foundation.

The next step should **not** be another architecture redesign.

The next step is to convert critical-path assumptions into explicit decisions with:

```text
Decision
Owner
Status
Deadline
Affected Phase
Acceptance Criteria
```

The most important decisions are:

```text
Availability model
-> Ownership / Manager model
-> Payment / Payout model
-> Cancellation / Refund policy
-> Search MVP
-> Notification requirement
-> License gating
-> Admin capability
```

Once these are frozen, the document can become the shared implementation baseline for:

- PM
- BA
- Backend
- Frontend
- QA
- DevOps
- Business stakeholders

and development can proceed phase-by-phase without repeatedly reopening the architecture.

---

## Recommended Next Document Version

The next revision of the backend baseline should add:

1. **Decision Register**
2. **MVP Scope Matrix — Included / Deferred**
3. **Business Rule Matrix**
4. **Role & Permission Matrix**
5. **Booking / Payment Policy Matrix**
6. **Phase Entry / Exit Gates**
7. **Business UAT Acceptance Criteria**
8. **Production Readiness Checklist**

This will transform the current document from a strong **Backend Technical Reference** into a true **Implementation & Delivery Baseline**.
