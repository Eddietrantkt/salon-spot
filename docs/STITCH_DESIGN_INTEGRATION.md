# Stitch design integration — 27/08/2026

## Objective

Apply the compatible visual language from `stitch_the_salon_spot_marketplace.zip` to the active React web application, while preserving the current MySQL/NestJS MVP contracts and business rules.

## Source reviewed

The archive contains five visual references: discovery, search results, workspace detail, my bookings, and my salons. It also contains the `Atelier Market` design reference: warm neutral surfaces, bronze accent, editorial serif headings, Manrope functional text, 8px spacing, 16px cards, and responsive navigation.

## Implemented mapping

| Design reference | Implemented web surface | Data source / constraint |
| --- | --- | --- |
| Discover workspaces | New responsive navigation, editorial discovery hero and a two-field location/date search card | Existing `GET /workspaces?area=&date=` only |
| Search results | Image-led responsive Workspace cards, price badge, availability count and action | `WorkspaceSearchItem`; availability remains server-authoritative |
| Workspace details | Published-media gallery and a separate slot-selection rail | `WorkspaceDetailResponse`; only current open fixed slots are selectable |
| My bookings | New `Booking của tôi` screen with upcoming/past/cancelled tabs, login/register and cancellation action | Existing refresh, `GET /me/bookings`, and booking-cancel endpoints |
| My salons / Owner | Warm-neutral cards, status badges, media grid, schedule controls and owner forms share the same token layer | Existing `OwnerSalon`, media and availability endpoints |

## Follow-up frontend extension

The following enhancements were added after reviewing the discovery/listing patterns used by Vagaro. They remain intentionally limited to the existing Workspace-rental MVP.

| Enhancement | Behavior | Boundary preserved |
| --- | --- | --- |
| Sticky result search | A compact area/date search bar appears after a search and stays reachable while the result list scrolls | Same `GET /workspaces?area=&date=` query; no service/category/filter parameters |
| Discovery skeleton | Three non-interactive cards communicate loading while search is in flight | The empty/error state remains separate; no fabricated Workspace data |
| Owner loading skeleton | Avoids showing an empty setup form while an authenticated Owner's Salon list is still loading | No optimistic ownership or setup state is inferred |
| Owner operational overview | Counts Salons, published/draft Workspaces and READY Workspace media | This is an observational summary, not a replacement for the server publish checklist |
| Slot status summary | After the Owner explicitly loads one Workspace/day schedule, it summarizes OPEN/BLOCKED/HELD/BOOKED slots | Reads the existing schedule response only; booking/hold rules stay server-authoritative |

## Explicitly not applied

- Messages/chat, ratings, favorites, specialty and amenities filters: no matching MVP contracts or flows.
- Owner approval, pending requests, full-day/morning/afternoon booking: conflict with the fixed-slot, instant hold/confirm model.
- Mockup photos and example addresses/prices: not product assets or server data. Workspace/Salon views use only media returned by the system and gracefully fall back when media is absent.
- The mockup's external Tailwind CDN: not introduced; the existing React/Vite app has no new UI dependency.

## Accessibility and responsive behavior

- Keyboard focus uses a visible high-contrast outline; controls keep minimum usable touch height.
- At small widths, navigation exposes the two frequent professional actions and content becomes a one-column layout with no horizontal overflow.
- Motion is reduced for users who enable `prefers-reduced-motion`.
- Typography uses Lora and Manrope because the original serif reference did not render Vietnamese diacritics reliably in form headings.

## Validation

- `pnpm --filter @salon-spot/web typecheck` passed.
- `pnpm --filter @salon-spot/web test` passed: 4 tests.
- `pnpm --filter @salon-spot/web build` passed.
- Local browser QA passed on desktop and 375px mobile: no console errors or horizontal overflow on Discovery, Booking của tôi, and Owner unauthenticated states.

## Remaining verification

The API was not running during visual QA, so visual validation with a real published Workspace, media gallery, slots, authenticated booking cards, and populated Owner Salon cards remains to be performed after the normal local API/MySQL startup.
