import { mkdir, stat, writeFile } from 'node:fs/promises';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { resolve } from 'node:path';

const runId = `${process.pid}-${Date.now()}`;
const project = process.env.P1_BACKUP_COMPOSE_PROJECT ?? `salon-spot-p1-backup-${runId}`;
const compose = ['compose', '--project-name', project, '-f', 'compose.p1-backup.yaml'];
const artifactDir = resolve(process.env.P1_ARTIFACT_DIR ?? `artifacts/p1-backup-restore/${runId}`);
const dumpPath = resolve(artifactDir, 'p1-source.sql');
const reportPath = resolve(artifactDir, 'report.json');
const prismaCli = resolve('apps/api/node_modules/prisma/build/index.js');
const schemaPath = resolve('apps/api/prisma/schema.prisma');

async function availablePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen({ host: '127.0.0.1', port: 0 }, () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('Unable to allocate an isolated host port.')));
        return;
      }
      server.close((error) => error ? reject(error) : resolve(String(address.port)));
    });
  });
}

function run(command, args, env = process.env, output = 'inherit', input) {
  const result = spawnSync(command, args, { cwd: process.cwd(), env, input, stdio: output });
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed.`);
  return result;
}

function runPrisma(databaseUrl) {
  run(process.execPath, [prismaCli, 'migrate', 'deploy', '--schema', schemaPath], { ...process.env, DATABASE_URL: databaseUrl });
}

async function runPrismaWithRetry(databaseUrl, label) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      runPrisma(databaseUrl);
      return;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 2_000));
    }
  }
  throw new Error(`${label} Prisma migration failed after 3 attempts: ${lastError instanceof Error ? lastError.message : 'unknown error'}`);
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
      if (response.ok) return response.status;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'unknown error';
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(`${label} did not become ready: ${lastError}`);
}

function terminate(child) {
  return new Promise((resolve) => {
    if (child.exitCode !== null) return resolve();
    child.once('exit', resolve);
    child.kill('SIGTERM');
    setTimeout(() => {
      if (child.exitCode === null) child.kill('SIGKILL');
    }, 10_000);
  });
}

async function postRestoreSmoke(restoreUrl, apiPort, workerPort) {
  const env = {
    ...process.env,
    DATABASE_URL: restoreUrl,
    PORT: apiPort,
    WORKER_PORT: workerPort,
    JWT_ACCESS_SECRET: 'p1-rehearsal-jwt-secret-must-be-at-least-thirty-two-characters',
    REFRESH_TOKEN_PEPPER: 'p1-rehearsal-refresh-secret-must-be-at-least-thirty-two-characters',
    MEDIA_UPLOAD_SECRET: 'p1-rehearsal-media-secret-must-be-at-least-thirty-two-characters',
    MEDIA_STORAGE_ROOT: '.data/p1-restore-media',
    WORKER_TICK_INTERVAL_SECONDS: '1',
    WORKER_STARTUP_GRACE_SECONDS: '1',
    WORKER_STALE_AFTER_SECONDS: '30',
    WORKER_WATCHDOG_INTERVAL_SECONDS: '1'
  };
  const api = spawn(process.execPath, ['apps/api/dist/main.js'], { cwd: process.cwd(), env, stdio: 'inherit' });
  const worker = spawn(process.execPath, ['apps/api/dist/worker-main.js'], { cwd: process.cwd(), env, stdio: 'inherit' });
  try {
    return {
      apiReady: await waitForHttp(`http://127.0.0.1:${apiPort}/api/v1/health/ready`, 'restored API'),
      workerReady: await waitForHttp(`http://127.0.0.1:${workerPort}/worker/health/ready`, 'restored worker', 90_000)
    };
  } finally {
    await Promise.all([terminate(api), terminate(worker)]);
  }
}

function counts(database) {
  const result = run('docker', [...compose, 'exec', '-T', database, 'mysql', '-N', '-B', '-u', 'p1_user', '-pp1_password_only_for_disposable_rehearsal', database === 'source' ? 'p1_source' : 'p1_restore', '-e', 'SELECT (SELECT COUNT(*) FROM User), (SELECT COUNT(*) FROM Salon), (SELECT COUNT(*) FROM Workspace), (SELECT COUNT(*) FROM AvailabilitySlot), (SELECT COUNT(*) FROM SlotHold), (SELECT COUNT(*) FROM Booking), (SELECT COUNT(*) FROM AuditEvent), (SELECT COUNT(*) FROM OutboxEvent);'], process.env, 'pipe');
  const values = String(result.stdout).trim().split('\t').map(Number);
  if (values.length !== 8 || values.some((value) => !Number.isInteger(value) || value < 1)) throw new Error(`${database} invariant counts are incomplete: ${String(result.stdout).trim()}`);
  return values;
}

function mapCounts(values) {
  return { users: values[0], salons: values[1], workspaces: values[2], slots: values[3], holds: values[4], bookings: values[5], audits: values[6], outbox: values[7] };
}

async function main() {
  const startedAt = new Date();
  const sourceHostPort = process.env.P1_BACKUP_SOURCE_HOST_PORT ?? await availablePort();
  const restoreHostPort = process.env.P1_BACKUP_RESTORE_HOST_PORT ?? await availablePort();
  const apiPort = process.env.P1_BACKUP_API_PORT ?? await availablePort();
  const workerPort = process.env.P1_BACKUP_WORKER_PORT ?? await availablePort();
  const sourceUrl = `mysql://p1_user:p1_password_only_for_disposable_rehearsal@127.0.0.1:${sourceHostPort}/p1_source`;
  const restoreUrl = `mysql://p1_user:p1_password_only_for_disposable_rehearsal@127.0.0.1:${restoreHostPort}/p1_restore`;
  const composeEnvironment = { ...process.env, P1_BACKUP_SOURCE_HOST_PORT: sourceHostPort, P1_BACKUP_RESTORE_HOST_PORT: restoreHostPort };
  const evidence = { gate: 'P1_BACKUP_RESTORE', status: 'failed', startedAt: startedAt.toISOString(), project, sourceHostPort, restoreHostPort, apiPort, workerPort, migration: {}, backup: {}, restore: {}, countInvariant: null, readinessAfterRestore: null };
  try {
    await mkdir(artifactDir, { recursive: true });
    run('docker', [...compose, 'down', '--volumes'], composeEnvironment);
    run('docker', [...compose, 'up', '-d'], composeEnvironment);
    await Promise.all([waitForService('source'), waitForService('restore')]);

    const sourceMigrationStartedAt = Date.now();
    await runPrismaWithRetry(sourceUrl, 'source');
    evidence.migration.sourceMs = Date.now() - sourceMigrationStartedAt;
    run(process.execPath, ['apps/api/dist/scripts/seed-p1-backup-fixture.js'], { ...process.env, DATABASE_URL: sourceUrl });
    const sourceCounts = counts('source');

    const backupStartedAt = Date.now();
    const dump = run('docker', [...compose, 'exec', '-T', 'source', 'mysqldump', '-u', 'p1_user', '-pp1_password_only_for_disposable_rehearsal', '--single-transaction', '--routines', '--events', '--no-tablespaces', 'p1_source'], process.env, 'pipe');
    await writeFile(dumpPath, dump.stdout);
    evidence.backup.ms = Date.now() - backupStartedAt;

    const restoreStartedAt = Date.now();
    const restoreContainer = String(run('docker', [...compose, 'ps', '-q', 'restore'], process.env, 'pipe').stdout).trim();
    if (!restoreContainer) throw new Error('Restore container was not found.');
    run('docker', ['cp', dumpPath, `${restoreContainer}:/tmp/p1-source.sql`]);
    run('docker', ['exec', restoreContainer, 'sh', '-ec', 'mysql -u p1_user -pp1_password_only_for_disposable_rehearsal p1_restore < /tmp/p1-source.sql']);
    await runPrismaWithRetry(restoreUrl, 'restore');
    evidence.migration.restoreMs = Date.now() - restoreStartedAt;
    const restoredCounts = counts('restore');
    if (sourceCounts.some((value, index) => value !== restoredCounts[index])) throw new Error(`Restored counts differ from source: ${sourceCounts.join(',')} != ${restoredCounts.join(',')}`);
    evidence.restore.ms = Date.now() - restoreStartedAt;
    evidence.countInvariant = { source: mapCounts(sourceCounts), restored: mapCounts(restoredCounts), matched: true };
    evidence.readinessAfterRestore = await postRestoreSmoke(restoreUrl, apiPort, workerPort);
    const dumpStats = await stat(dumpPath);
    evidence.backup.dumpBytes = dumpStats.size;
    evidence.status = 'passed';
    await writeFile(reportPath, `${JSON.stringify(evidence, null, 2)}\n`);
    console.log(`P1 backup/restore rehearsal passed. Evidence: ${reportPath}`);
  } catch (error) {
    evidence.error = error instanceof Error ? error.message : 'P1 backup/restore rehearsal failed.';
    await mkdir(artifactDir, { recursive: true });
    await writeFile(reportPath, `${JSON.stringify(evidence, null, 2)}\n`);
    throw error;
  } finally {
    run('docker', [...compose, 'down', '--volumes'], composeEnvironment);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'P1 backup/restore rehearsal failed.');
  process.exitCode = 1;
});
