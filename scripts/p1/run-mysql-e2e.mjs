import { spawnSync } from 'node:child_process';

function run(command, args, environment = process.env) {
  const invocation = process.platform === 'win32' && command === 'pnpm'
    ? [process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', [command, ...args].join(' ')]]
    : [command, args];
  const result = spawnSync(invocation[0], invocation[1], { cwd: process.cwd(), env: environment, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL must point to a disposable MySQL database for P1 MySQL E2E.');
  process.exit(2);
}

const env = { ...process.env, RUN_MYSQL_E2E: '1' };
run('pnpm', ['prisma:generate'], env);
run('pnpm', ['--filter', '@salon-spot/api', 'exec', 'prisma', 'migrate', 'deploy', '--schema', 'prisma/schema.prisma'], env);
run('pnpm', ['--filter', '@salon-spot/api', 'test', '--runTestsByPath', 'test/availability.mysql.spec.ts', 'test/professional-identity.mysql.spec.ts', 'test/p1-http-bola.mysql.spec.ts'], env);
