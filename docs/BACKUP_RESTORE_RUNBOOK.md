# P1 Backup / Restore Rehearsal

## Scope and safety

This rehearsal proves that a synthetic MySQL 8.4 database can be backed up and restored into a **separate** MySQL 8.4 container. It is not a production RPO/RTO SLA. It never uses production credentials or a production dump.

`pnpm p1:backup-restore` creates `source` and `restore` containers from `compose.p1-backup.yaml`, migrates and seeds source, emits a synthetic SQL dump under `artifacts/p1-backup-restore/`, restores it into the empty `restore` service, reapplies `migrate deploy`, and checks representative User, Salon, Workspace, slot, hold, Booking, audit and outbox counts. The JSON report records duration and dump size.

## Run

```powershell
pnpm prisma:generate
pnpm build
pnpm p1:backup-restore
Get-Content artifacts/p1-backup-restore/report.json
docker compose -f compose.p1-backup.yaml down --volumes --remove-orphans
```

Keep the generated dump only as a protected, time-limited CI artifact. Do not attach real customer data to a ticket, commit it, or use this script on a production host.

## Acceptance

- Source and restore use different container volumes and database instances.
- Source migration/fixture, dump, import, restore migration and invariant query succeed.
- API/worker post-restore readiness smoke is attached to the release record.
- The evidence report includes backup/restore duration, dump size and any error.

Before claiming an operational SLA, owners must separately set production retention, encryption, storage region, restore authorization, RPO and RTO.
