import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const runId = `${process.pid}-${Date.now()}`;
const project = process.env.P1_BROWSER_COMPOSE_PROJECT ?? `salon-spot-p1-browser-${runId}`;
const artifactDir = resolve(process.env.P1_BROWSER_ARTIFACT_DIR ?? `artifacts/p1-browser/${runId}`);
const reportPath = join(artifactDir, 'report.json');
const sourceEnvFile = process.env.P1_BROWSER_ENV_FILE ?? process.env.RUNTIME_ENV_FILE ?? '.env.runtime';

async function availablePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen({ host: '127.0.0.1', port: 0 }, () => {
      const address = server.address();
      if (!address || typeof address === 'string') return server.close(() => reject(new Error('Unable to allocate an isolated host port.')));
      server.close((error) => error ? reject(error) : resolve(String(address.port)));
    });
  });
}

function parseEnv(source) {
  const values = new Map();
  for (const line of source.split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const index = line.indexOf('=');
    if (index > 0) values.set(line.slice(0, index), line.slice(index + 1));
  }
  return values;
}

async function isolatedEnv(mysqlHostPort, webHostPort, baseUrl) {
  const source = await readFile(sourceEnvFile, 'utf8').catch((error) => error?.code === 'ENOENT' ? readFile('.env.runtime.example', 'utf8') : Promise.reject(error));
  const values = parseEnv(source);
  values.set('MYSQL_DATABASE', 'p1_browser');
  values.set('MYSQL_USER', 'p1_browser');
  values.set('MYSQL_PASSWORD', 'p1-browser-password-only-for-disposable-uat');
  values.set('MYSQL_ROOT_PASSWORD', 'p1-browser-root-password-only-for-disposable-uat');
  values.set('DATABASE_URL', 'mysql://p1_browser:p1-browser-password-only-for-disposable-uat@mysql:3306/p1_browser');
  values.set('JWT_ACCESS_SECRET', 'p1-browser-jwt-secret-must-be-at-least-thirty-two-characters');
  values.set('REFRESH_TOKEN_PEPPER', 'p1-browser-refresh-secret-must-be-at-least-thirty-two-characters');
  values.set('MEDIA_UPLOAD_SECRET', 'p1-browser-media-secret-must-be-at-least-thirty-two-characters');
  values.set('MYSQL_HOST_PORT', mysqlHostPort);
  values.set('WEB_HOST_PORT', webHostPort);
  values.set('WEB_ORIGIN', baseUrl);
  values.set('MEDIA_PUBLIC_BASE_URL', `${baseUrl}/api/v1`);
  values.set('WORKER_TICK_INTERVAL_SECONDS', '1');
  values.set('WORKER_STARTUP_GRACE_SECONDS', '1');
  values.set('WORKER_STALE_AFTER_SECONDS', '30');
  values.set('WORKER_WATCHDOG_INTERVAL_SECONDS', '1');
  const directory = await mkdtemp(join(tmpdir(), 'salon-spot-p1-browser-'));
  const file = join(directory, '.env.runtime');
  await writeFile(file, `${[...values].map(([key, value]) => `${key}=${value}`).join('\n')}\n`, { mode: 0o600 });
  return { directory, file };
}

function docker(args, envFile, output = 'inherit') {
  const result = spawnSync('docker', args, { cwd: process.cwd(), env: { ...process.env, RUNTIME_ENV_FILE: envFile }, stdio: output });
  if (result.status !== 0) throw new Error(`docker ${args.join(' ')} failed.`);
  return result;
}

function command(command, args, environment) {
  const [binary, invocation] = process.platform === 'win32' && command === 'pnpm'
    ? [process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', [command, ...args].join(' ')]]
    : [command, args];
  const result = spawnSync(binary, invocation, { cwd: process.cwd(), env: environment, stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed.`);
  return result;
}

function sourceRevision() {
  const revision = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: process.cwd(), encoding: 'utf8' });
  const status = spawnSync('git', ['status', '--porcelain'], { cwd: process.cwd(), encoding: 'utf8' });
  return {
    sha: revision.status === 0 ? revision.stdout.trim() : process.env.GITHUB_SHA ?? 'unavailable',
    dirty: status.status === 0 ? Boolean(status.stdout.trim()) : null
  };
}

function containerEvidence(compose, envFile, service) {
  const containerId = String(docker([...compose, 'ps', '-a', '-q', service], envFile, 'pipe').stdout).trim();
  if (!containerId) throw new Error(`Unable to resolve the ${service} container.`);
  const result = spawnSync('docker', ['inspect', containerId], { cwd: process.cwd(), encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`Unable to inspect the ${service} container.`);
  const inspected = JSON.parse(result.stdout)[0];
  return { containerId, imageName: inspected.Config.Image, imageId: inspected.Image };
}

async function captureComposeDiagnostics(compose, envFile) {
  const ps = spawnSync('docker', [...compose, 'ps', '-a', '--format', 'json'], {
    cwd: process.cwd(), env: { ...process.env, RUNTIME_ENV_FILE: envFile }, encoding: 'utf8'
  });
  await writeFile(join(artifactDir, 'compose-ps.jsonl'), `${ps.stdout ?? ''}${ps.stderr ?? ''}`);
  const logs = spawnSync('docker', [...compose, 'logs', '--no-color'], {
    cwd: process.cwd(), env: { ...process.env, RUNTIME_ENV_FILE: envFile }, encoding: 'utf8'
  });
  await writeFile(join(artifactDir, 'compose.log'), `${logs.stdout ?? ''}${logs.stderr ?? ''}`);
}

async function waitFor(label, predicate, timeoutMs = 180_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const value = await predicate();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  const detail = lastError instanceof Error ? ` Last transient error: ${lastError.message}` : '';
  throw new Error(`${label} did not become ready.${detail}`);
}

async function main() {
  const mysqlHostPort = process.env.P1_BROWSER_MYSQL_HOST_PORT ?? await availablePort();
  const webHostPort = process.env.P1_BROWSER_WEB_HOST_PORT ?? await availablePort();
  const baseUrl = process.env.P1_BROWSER_BASE_URL ?? `http://127.0.0.1:${webHostPort}`;
  const evidence = {
    gate: 'P1_PACKAGED_BROWSER_UAT',
    status: 'failed',
    startedAt: new Date().toISOString(),
    project,
    baseUrl,
    mysqlHostPort,
    webHostPort,
    source: sourceRevision()
  };
  let runtime;
  let compose;
  let failure;
  try {
    await mkdir(artifactDir, { recursive: true });
    runtime = await isolatedEnv(mysqlHostPort, webHostPort, baseUrl);
    compose = ['compose', '--project-name', project, '--env-file', runtime.file, '-f', 'compose.runtime.yaml'];
    docker([...compose, 'down', '--volumes', '--rmi', 'local'], runtime.file);
    // Keep build and start distinct. On Docker Desktop, `up --build` can leave
    // a CLI process hanging after image export, with no containers started.
    docker([...compose, 'build'], runtime.file);
    docker([...compose, 'up', '-d'], runtime.file);
    const migrationId = String(docker([...compose, 'ps', '-a', '-q', 'migrate'], runtime.file, 'pipe').stdout).trim();
    const migrationState = await waitFor('Prisma migration', () => {
      const result = spawnSync('docker', ['inspect', '-f', '{{.State.Status}}:{{.State.ExitCode}}', migrationId], { encoding: 'utf8' });
      const state = String(result.stdout).trim();
      return result.status === 0 && state.startsWith('exited:') ? state : false;
    });
    const migrationExitCode = Number(migrationState.split(':')[1]);
    evidence.migration = { containerId: migrationId, exitCode: migrationExitCode };
    if (migrationExitCode !== 0) throw new Error(`Prisma migration exited ${migrationExitCode}.`);
    await waitFor('packaged web', async () => (await fetch(baseUrl)).ok);
    await waitFor('API readiness', async () => (await fetch(`${baseUrl}/api/v1/health/ready`)).ok);
    evidence.images = Object.fromEntries(['api', 'worker', 'web'].map((service) => [service, containerEvidence(compose, runtime.file, service)]));
    const seedStartedAt = Date.now();
    docker([...compose, 'exec', '-T', 'api', 'node', 'apps/api/dist/scripts/seed-demo.js'], runtime.file);
    evidence.seed = { status: 'passed', durationMs: Date.now() - seedStartedAt };
    const playwrightJsonPath = join(artifactDir, 'playwright-results.json');
    command('pnpm', ['exec', 'playwright', 'test'], {
      ...process.env,
      E2E_BASE_URL: baseUrl,
      PLAYWRIGHT_JSON_OUTPUT_FILE: playwrightJsonPath
    });
    const playwright = JSON.parse(await readFile(playwrightJsonPath, 'utf8'));
    evidence.playwright = {
      expected: playwright.stats?.expected ?? null,
      unexpected: playwright.stats?.unexpected ?? null,
      flaky: playwright.stats?.flaky ?? null,
      skipped: playwright.stats?.skipped ?? null,
      durationMs: playwright.stats?.duration ?? null
    };
    evidence.status = 'passed';
  } catch (error) {
    failure = error;
    evidence.error = error instanceof Error ? error.message : 'P1 packaged browser UAT failed.';
  } finally {
    if (runtime) {
      try {
        if (compose) await captureComposeDiagnostics(compose, runtime.file);
      } catch (error) {
        evidence.diagnosticsError = error instanceof Error ? error.message : 'Unable to capture Compose diagnostics.';
      }
      try {
        docker([...(compose ?? []), 'down', '--volumes', '--rmi', 'local'], runtime.file);
        evidence.cleanup = { status: 'passed' };
      } catch (error) {
        evidence.cleanup = { status: 'failed', error: error instanceof Error ? error.message : 'Compose cleanup failed.' };
        if (!failure) {
          failure = error;
          evidence.status = 'failed';
          evidence.error = evidence.cleanup.error;
        }
      } finally {
        await rm(runtime.directory, { recursive: true, force: true });
      }
    }
    evidence.completedAt = new Date().toISOString();
    await mkdir(artifactDir, { recursive: true });
    await writeFile(reportPath, `${JSON.stringify(evidence, null, 2)}\n`);
  }
  if (failure) throw failure;
  console.log(`P1 packaged browser UAT passed. Evidence: ${reportPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'P1 packaged browser UAT failed.');
  process.exitCode = 1;
});
