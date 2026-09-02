import { mkdir, stat, writeFile } from 'node:fs/promises';
import { spawn, spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const compose = ['compose', '-f', 'compose.p1-backup.yaml'];
const sourceUrl = 'mysql://p1_user:p1_password_only_for_disposable_rehearsal@127.0.0.1:3310/p1_source';
const restoreUrl = 'mysql://p1_user:p1_password_only_for_disposable_rehearsal@127.0.0.1:3311/p1_restore';
const artifactDir = resolve(process.env.P1_ARTIFACT_DIR ?? 'artifacts/p1-backup-restore');
const dumpPath = resolve(artifactDir, 'p1-source.sql');
const reportPath = resolve(artifactDir, 'report.json');

function run(command, args, env = process.env, output = 'inherit') {
  const invocation = process.platform === 'win32' && command === 'pnpm'
    ? [process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', [command, ...args].join(' ')]]
    : [command, args];
  const result = spawnSync(invocation[0], invocation[1], { cwd: process.cwd(), env, stdio: output });
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed.`);
  return result;
}

async function waitForService(service) {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    const result = spawnSync('docker', [...compose, 'exec', '-T', service, 'mysqladmin', 'ping', '-h', 'localhost', '-u', 'root', '-pp1_root_only_for_disposable_rehearsal'], { cwd: process.cwd(), stdio: 'ignore' });
    if (result.status === 0) return;
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  throw new Error(`${service} MySQL did not become healthy.`);
}

async function waitForHttp(url, label, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = 'not attempted';
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'unknown error';
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(`${label} did not become ready: ${lastError}`);
}

async function postRestoreSmoke() {
  const env = {
    ...process.env,
    DATABASE_URL: restoreUrl,
    PORT: '3302',
    WORKER_PORT: '3303',
    JWT_ACCESS_SECRET: 'p1-rehearsal-jwt-secret-must-be-at-least-thirty-two-characters',
    REFRESH_TOKEN_PEPPER: 'p1-rehearsal-refresh-secret-must-be-at-least-thirty-two-characters',
    MEDIA_UPLOAD_SECRET: 'p1-rehearsal-media-secret-must-be-at-least-thirty-two-characters',
    MEDIA_STORAGE_ROOT: '.data/p1-restore-media',
    WORKER_TICK_INTERVAL_SECONDS: '1',
    WORKER_STARTUP_GRACE_SECONDS: '1',
    WORKER_STALE_AFTER_SECONDS: '30',
    WORKER_WATCHDOG_INTERVAL_SECONDS: '1'
  };
  const api = spawn('node', ['apps/api/dist/main.js'], { cwd: process.cwd(), env, stdio: 'inherit' });
  const worker = spawn('node', ['apps/api/dist/worker-main.js'], { cwd: process.cwd(), env, stdio: 'inherit' });
  try {
    await waitForHttp('http://127.0.0.1:3302/api/v1/health/ready', 'restored API');
    await waitForHttp('http://127.0.0.1:3303/worker/health/ready', 'restored worker', 90_000);
  } finally {
    api.kill('SIGTERM');
    worker.kill('SIGTERM');
  }
}

async function main() {
  const startedAt = new Date();
  await mkdir(artifactDir, { recursive: true });
  run('docker', [...compose, 'up', '-d']);
  await Promise.all([waitForService('source'), waitForService('restore')]);
  const migratedAt = Date.now();
  run('pnpm', ['--filter', '@salon-spot/api', 'exec', 'prisma', 'migrate', 'deploy', '--schema', 'prisma/schema.prisma'], { ...process.env, DATABASE_URL: sourceUrl });
  run('node', ['apps/api/dist/scripts/seed-p1-backup-fixture.js'], { ...process.env, DATABASE_URL: sourceUrl });
  const backupStartedAt = Date.now();
  const dump = run('docker', [...compose, 'exec', '-T', 'source', 'mysqldump', '-u', 'p1_user', '-pp1_password_only_for_disposable_rehearsal', '--single-transaction', '--routines', '--events', 'p1_source'], process.env, 'pipe');
  await writeFile(dumpPath, dump.stdout);
  const restoreStartedAt = Date.now();
  const importResult = spawnSync('docker', [...compose, 'exec', '-T', 'restore', 'mysql', '-u', 'p1_user', '-pp1_password_only_for_disposable_rehearsal', 'p1_restore'], { cwd: process.cwd(), input: dump.stdout, stdio: ['pipe', 'inherit', 'inherit'], shell: process.platform === 'win32' });
  if (importResult.status !== 0) throw new Error('Restore import failed.');
  run('pnpm', ['--filter', '@salon-spot/api', 'exec', 'prisma', 'migrate', 'deploy', '--schema', 'prisma/schema.prisma'], { ...process.env, DATABASE_URL: restoreUrl });
  const counts = run('docker', [...compose, 'exec', '-T', 'restore', 'mysql', '-N', '-B', '-u', 'p1_user', '-pp1_password_only_for_disposable_rehearsal', 'p1_restore', '-e', 'SELECT (SELECT COUNT(*) FROM User), (SELECT COUNT(*) FROM Salon), (SELECT COUNT(*) FROM Workspace), (SELECT COUNT(*) FROM AvailabilitySlot), (SELECT COUNT(*) FROM SlotHold), (SELECT COUNT(*) FROM Booking), (SELECT COUNT(*) FROM AuditEvent), (SELECT COUNT(*) FROM OutboxEvent);'], process.env, 'pipe');
  const values = String(counts.stdout).trim().split('\t').map(Number);
  if (values.length !== 8 || values.some((value) => !Number.isInteger(value) || value < 1)) throw new Error(`Restored invariant counts are incomplete: ${String(counts.stdout).trim()}`);
  await postRestoreSmoke();
  const dumpStats = await stat(dumpPath);
  await writeFile(reportPath, `${JSON.stringify({
    gate: 'P1_BACKUP_RESTORE', status: 'passed', startedAt: startedAt.toISOString(),
    migrationMs: backupStartedAt - migratedAt, backupMs: restoreStartedAt - backupStartedAt,
    restoreAndVerifyMs: Date.now() - restoreStartedAt, dumpBytes: dumpStats.size,
    restoredCounts: { users: values[0], salons: values[1], workspaces: values[2], slots: values[3], holds: values[4], bookings: values[5], audits: values[6], outbox: values[7] }
  }, null, 2)}\n`);
  console.log(`P1 backup/restore rehearsal passed. Evidence: ${reportPath}`);
}

main().catch((error) => { console.error(error instanceof Error ? error.message : 'P1 backup/restore rehearsal failed.'); process.exitCode = 1; });
