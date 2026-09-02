import { spawnSync } from 'node:child_process';

const composeFile = 'compose.runtime.yaml';
const envFile = process.env.RUNTIME_ENV_FILE ?? '.env.runtime';
const baseUrl = process.env.RUNTIME_BASE_URL ?? 'http://127.0.0.1:8080';
const compose = ['compose', '--env-file', envFile, '-f', composeFile];

function run(args) {
  const result = spawnSync('docker', args, { cwd: process.cwd(), stdio: 'inherit', env: { ...process.env, RUNTIME_ENV_FILE: envFile } });
  if (result.status !== 0) throw new Error(`docker ${args.join(' ')} failed.`);
}

async function waitFor(url, label, timeoutMs = 180_000) {
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
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  throw new Error(`${label} did not become ready: ${lastError}`);
}

try {
  run([...compose, 'up', '--build', '-d']);
  await waitFor(`${baseUrl}/api/v1/health/ready`, 'API readiness');
  await waitFor(baseUrl, 'web readiness');
  run([...compose, 'exec', '-T', 'worker', 'node', '-e', "fetch('http://127.0.0.1:3001/worker/health/ready').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]);
  console.log(JSON.stringify({ gate: 'P1_RUNTIME_SMOKE', status: 'passed', baseUrl }));
} catch (error) {
  console.error(error instanceof Error ? error.message : 'P1 runtime smoke failed.');
  process.exitCode = 1;
}
