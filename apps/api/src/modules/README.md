# Module ownership

Each module has one responsibility and is the only location allowed to write its aggregate.

| Module | Owns | Current status |
| --- | --- | --- |
| Auth | Credentials, JWT access tokens and rotating refresh sessions | Implemented |
| Users | Shared account profile | Scaffold only |
| Professionals | Professional profile and license metadata | Scaffold only |
| Salons | Salon lifecycle and membership scope | Owner supply + BOLA implemented |
| Workspaces | Workspace publication and rental options | Owner authoring/publish implemented |
| Availability | Slots, blocks, holds and lock order | Fixed slots + batch block implemented; holds pending |
| Bookings | Booking lifecycle and immutable snapshot | Scaffold only |
| Payments | Provider checkout, webhook and refund records | Scaffold only; approval-dependent |
| Media | Upload finalization and public visibility | D3-D4 lifecycle implemented |
| Chat | Conversations and messages | Scaffold only |
| Admin | Audited recovery operations | Scaffold only |
| Discovery | Public read query for published workspaces | Implemented |

Keep controllers thin. A feature's application service owns its transaction boundary; other modules use an explicit public facade only when a real cross-module use case exists. Shared contracts remain in `packages/contracts` and never expose Prisma models.
