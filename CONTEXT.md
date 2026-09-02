# The Salon Spot Domain Language

The Salon Spot connects Beauty Professionals who need short-term workspaces with Salon Owners who make those workspaces available. One User identity can hold several independent capabilities.

## Identity and roles

**User**:
The shared identity used for authentication, account status, and password recovery regardless of role.
_Avoid_: Account role, Owner account, Professional account

**Salon Owner**:
A User who holds an OWNER membership for a specific Salon.
_Avoid_: Global Owner role

**Beauty Professional**:
A User with a Professional Profile who may become eligible to reserve a Workspace.
_Avoid_: Customer, renter role

**Platform Administrator**:
A User with platform operations access; sensitive actions may require an additional permission.
_Avoid_: Salon Owner, superuser by default

## Professional trust

**Professional Profile**:
The role-specific record that identifies a User as a Beauty Professional and carries their platform access and current verification summary.
_Avoid_: License, verification case

**Registration Intent**:
A User's initial choice of Professional or Owner onboarding. It routes the onboarding journey; it is not a permanent or exclusive authorization role.
_Avoid_: Global account role

**Credential**:
A structured professional license or insurance assertion with an issuer, jurisdiction, validity period, and review outcome.
_Avoid_: Document, profile status

**Professional Document**:
Private file evidence supplied for identity, license, or insurance review.
_Avoid_: Public media, credential

**Verification Case**:
One submission and review cycle that records its evidence, decision, reviewer, and reason.
_Avoid_: Professional profile, permanent verification

**Booking Eligibility**:
A policy decision derived from User status, Professional Profile access, verification, credential validity, and the target booking time.
_Avoid_: Stored canBook flag, login permission

## Marketplace

**Salon**:
The business and location context managed through Salon membership.
_Avoid_: Workspace, listing

**Workspace**:
The capacity-one station, suite, or room selected for a reservation.
_Avoid_: Salon, generic listing

**Availability Slot**:
A predefined Salon-local time interval that represents the authoritative reservable inventory for one Workspace.
_Avoid_: Calendar event, free-form availability

**Slot Hold**:
A temporary exclusive claim by one Beauty Professional on one Availability Slot before confirmation.
_Avoid_: Booking, reservation request

**Booking**:
A confirmed reservation with immutable commercial and Salon-time snapshots.
_Avoid_: Slot hold, payment
