import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const composeFile = 'compose.runtime.yaml';
const sourceEnvFile = process.env.P1_RUNTIME_ENV_FILE ?? process.env.RUNTIME_ENV_FILE ?? '.env.runtime';
const project = process.env.P1_RUNTIME_COMPOSE_PROJECT ?? 'salon-spot-p1-runtime-smoke';
const artifactDir = resolve(process.env.P1_RUNTIME_ARTIFACT_DIR ?? 'artifacts/p1-runtime-smoke');
const reportPath = resolve(artifactDir, 'report.json');
const mysqlHostPort = process.env.P1_RUNTIME_MYSQL_HOST_PORT ?? '13307';
const webHostPort = process.env.P1_RUNTIME_WEB_HOST_PORT ?? '18080';
const baseUrl = process.env.P1_RUNTIME_BASE_URL ?? `http://127.0.0.1:${webHostPort}`;
const rebuildImages = process.env.P1_RUNTIME_REBUILD !== '0';

function parseEnv(source) {
  const values = new Map();
  for (const line of source.split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const index = line.indexOf('=');
    if (index > 0) values.set(line.slice(0, index), line.slice(index + 1));
  }
  return values;
}

async function createIsolatedEnvFile() {
  const source = await readFile(sourceEnvFile, 'utf8').catch(async (error) => {
    if (error && error.code === 'ENOENT') return readFile('.env.runtime.example', 'utf8');
    throw error;
  });
  const values = parseEnv(source);
  const mysqlUser = 'p1_runtime';
  const mysqlPassword = 'p1-runtime-password-only-for-disposable-smoke';
  values.set('MYSQL_DATABASE', 'p1_runtime');
  values.set('MYSQL_USER', mysqlUser);
  values.set('MYSQL_PASSWORD', mysqlPassword);
  values.set('MYSQL_ROOT_PASSWORD', 'p1-runtime-root-password-only-for-disposable-smoke');
  values.set('DATABASE_URL', `mysql://${mysqlUser}:${mysqlPassword}@mysql:3306/p1_runtime`);
  values.set('JWT_ACCESS_SECRET', 'p1-runtime-jwt-secret-must-be-at-least-thirty-two-characters');
  values.set('REFRESH_TOKEN_PEPPER', 'p1-runtime-refresh-secret-must-be-at-least-thirty-two-characters');
  values.set('MEDIA_UPLOAD_SECRET', 'p1-runtime-media-secret-must-be-at-least-thirty-two-characters');
  values.set('MYSQL_HOST_PORT', mysqlHostPort);
  values.set('WEB_HOST_PORT', webHostPort);
  values.set('WEB_ORIGIN', baseUrl);
  values.set('MEDIA_PUBLIC_BASE_URL', `${baseUrl}/api/v1`);
  values.set('WORKER_TICK_INTERVAL_SECONDS', '1');
  values.set('WORKER_STARTUP_GRACE_SECONDS', '1');
  values.set('WORKER_STALE_AFTER_SECONDS', '30');
  values.set('WORKER_WATCHDOG_INTERVAL_SECONDS', '1');
  const directory = await mkdtemp(join(tmpdir(), 'salon-spot-p1-runtime-'));
  const file = join(directory, '.env.runtime');
  await writeFile(file, `${[...values].map(([key, value]) => `${key}=${value}`).join('\n')}\n`, { mode: 0o600 });
  return { directory, file };
}

function composeArgs(envFile) {
  return ['compose', '--project-name', project, '--env-file', envFile, '-f', composeFile];
}

function run(args, { envFile, output = 'inherit' } = {}) {
  const result = spawnSync('docker', args, {
    cwd: process.cwd(),
    env: { ...process.env, RUNTIME_ENV_FILE: envFile },
    stdio: output
  });
  if (result.status !== 0) throw new Error(`docker ${args.join(' ')} failed.`);
  return result;
}

function inspect(containerId) {
  const result = spawnSync('docker', ['inspect', containerId], { cwd: process.cwd(), encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`Unable to inspect container ${containerId}.`);
  return JSON.parse(result.stdout)[0];
}

function redactMigrationLog(value) {
  return value.replace(/mysql:\/\/[^\s@]+@/gi, 'mysql://<REDACTED>@');
}

function serviceLogs(compose, envFile, service) {
  const result = spawnSync('docker', [...compose, 'logs', '--no-color', service], {
    cwd: process.cwd(),
    env: { ...process.env, RUNTIME_ENV_FILE: envFile },
    encoding: 'utf8'
  });
  return redactMigrationLog(`${result.stdout ?? ''}${result.stderr ?? ''}`).trim();
}

async function waitFor(label, predicate, timeoutMs = 180_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = 'not attempted';
  while (Date.now() < deadline) {
    try {
      const value = await predicate();
      if (value) return value;
      lastError = 'condition not met';
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'unknown error';
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(`${label} did not become ready: ${lastError}`);
}

async function waitForHttp(url, label) {
  return waitFor(label, async () => {
    const response = await fetch(url);
    return response.ok ? response.status : false;
  });
}

function serviceId(compose, envFile, service, includeStopped = false) {
  return String(run([...compose, 'ps', ...(includeStopped ? ['-a'] : []), '-q', service], { envFile, output: 'pipe' }).stdout).trim();
}

function workerReady(compose, envFile) {
  const result = spawnSync('docker', [...compose, 'exec', '-T', 'worker', 'node', '-e', "fetch('http://127.0.0.1:3001/worker/health/ready').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"], {
    cwd: process.cwd(), env: { ...process.env, RUNTIME_ENV_FILE: envFile }, stdio: 'ignore'
  });
  return result.status === 0 ? 200 : false;
}

function mysqlQuery(compose, envFile, query) {
  const result = run([...compose, 'exec', '-T', 'mysql', 'sh', '-ec', 'mysql -N -B -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" -e "$1"', '--', query], { envFile, output: 'pipe' });
  return String(result.stdout).trim();
}

function heartbeatSnapshot(compose, envFile) {
  const output = mysqlQuery(compose, envFile, "SELECT workerName, DATE_FORMAT(lastSucceededAt, '%Y-%m-%dT%H:%i:%s.%fZ') FROM WorkerHeartbeat ORDER BY workerName");
  return Object.fromEntries(output.split(/\r?\n/).filter(Boolean).map((line) => {
    const [workerName, timestamp] = line.split('\t');
    return [workerName, timestamp];
  }));
}

function outboxSnapshot(compose, envFile, outboxId) {
  const output = mysqlQuery(compose, envFile, `SELECT id, status, attempts FROM OutboxEvent WHERE id = '${outboxId}'`);
  const [id, status, attempts] = output.split('\t');
  return { id, status, attempts: Number(attempts) };
}

function crashWorkerProcess(containerId) {
  const result = spawnSync('docker', ['exec', containerId, 'sh', '-ec', 'kill -TERM 1'], { cwd: process.cwd(), stdio: 'ignore' });
  if (result.status !== 0) throw new Error(`Unable to terminate worker process ${containerId}.`);
}

async function main() {
  const startedAt = new Date().toISOString();
  const evidence = { gate: 'P1_RUNTIME_RECOVERY', status: 'failed', startedAt, project, baseUrl, migration: null, http: {}, worker: {}, heartbeats: {}, outbox: null };
  let isolated;
  let compose;
  try {
    await mkdir(artifactDir, { recursive: true });
    isolated = await createIsolatedEnvFile();
    compose = composeArgs(isolated.file);
    run([...compose, 'down', '--volumes', ...(rebuildImages ? ['--rmi', 'local'] : [])], { envFile: isolated.file });
    if (rebuildImages) run([...compose, 'build', '--no-cache'], { envFile: isolated.file });
    run([...compose, 'up', '-d'], { envFile: isolated.file });

    const migrationId = serviceId(compose, isolated.file, 'migrate', true);
    const migration = await waitFor('migration completion', () => {
      const state = inspect(migrationId).State;
      return state.Status === 'exited' ? state : false;
    });
    if (migration.ExitCode !== 0) throw new Error(`Migration exited ${migration.ExitCode}.`);
    evidence.migration = { containerId: migrationId, exitCode: migration.ExitCode, finishedAt: migration.FinishedAt };
    evidence.http.live = await waitForHttp(`${baseUrl}/api/v1/health/live`, 'API liveness');
    evidence.http.ready = await waitForHttp(`${baseUrl}/api/v1/health/ready`, 'API readiness');
    evidence.http.web = await waitForHttp(baseUrl, 'web readiness');
    evidence.http.workerReady = await waitFor('worker readiness', () => workerReady(compose, isolated.file));

    const workerIdBefore = serviceId(compose, isolated.file, 'worker');
    const workerBefore = inspect(workerIdBefore);
    const heartbeatsBefore = heartbeatSnapshot(compose, isolated.file);
    run(['pause', workerIdBefore], { envFile: isolated.file });
    const seeded = run([...compose, 'exec', '-T', 'api', 'node', 'apps/api/dist/scripts/seed-p1-runtime-recovery-fixture.js'], { envFile: isolated.file, output: 'pipe' });
    const seedEvidence = JSON.parse(String(seeded.stdout).trim());
    run(['unpause', workerIdBefore], { envFile: isolated.file });
    crashWorkerProcess(workerIdBefore);

    const workerAfter = await waitFor('worker automatic restart', () => {
      const current = inspect(workerIdBefore);
      return current.State.Running && current.RestartCount > workerBefore.RestartCount ? current : false;
    });
    evidence.worker = {
      containerIdBefore: workerIdBefore,
      containerIdAfter: workerIdBefore,
      restartCountBefore: workerBefore.RestartCount,
      restartCountAfter: workerAfter.RestartCount,
      startedAtBefore: workerBefore.State.StartedAt,
      startedAtAfter: workerAfter.State.StartedAt
    };
    evidence.http.workerReadyAfterRecovery = await waitFor('worker recovery readiness', () => workerReady(compose, isolated.file));
    const heartbeatsAfter = await waitFor('all worker heartbeats to advance', () => {
      const snapshot = heartbeatSnapshot(compose, isolated.file);
      const names = ['hold-expiry', 'booking-lifecycle', 'media-cleanup'];
      return names.every((name) => snapshot[name] && heartbeatsBefore[name] && Date.parse(snapshot[name]) > Date.parse(heartbeatsBefore[name])) ? snapshot : false;
    });
    evidence.heartbeats = { before: heartbeatsBefore, after: heartbeatsAfter };
    evidence.outbox = await waitFor('expired outbox lease delivery', () => {
      const snapshot = outboxSnapshot(compose, isolated.file, seedEvidence.outboxId);
      return snapshot.status === 'DELIVERED' ? snapshot : false;
    });
    evidence.http.readyAfterRecovery = await waitForHttp(`${baseUrl}/api/v1/health/ready`, 'API readiness after worker recovery');
    evidence.status = 'passed';
    await writeFile(reportPath, `${JSON.stringify(evidence, null, 2)}\n`);
    console.log(`P1 runtime recovery smoke passed. Evidence: ${reportPath}`);
  } catch (error) {
    evidence.error = error instanceof Error ? error.message : 'P1 runtime recovery smoke failed.';
    if (isolated && compose) {
      evidence.migration = {
        ...(evidence.migration ?? {}),
        logs: serviceLogs(compose, isolated.file, 'migrate')
      };
    }
    await mkdir(artifactDir, { recursive: true });
    await writeFile(reportPath, `${JSON.stringify(evidence, null, 2)}\n`);
    throw error;
  } finally {
    if (isolated) {
      try {
        run([...(compose ?? composeArgs(isolated.file)), 'down', '--volumes', ...(rebuildImages ? ['--rmi', 'local'] : [])], { envFile: isolated.file });
      } finally {
        await rm(isolated.directory, { recursive: true, force: true });
      }
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'P1 runtime recovery smoke failed.');
  process.exitCode = 1;
});
