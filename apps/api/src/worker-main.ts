import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './common/worker/worker.module.js';
import { secondsFromEnv } from './common/worker/worker-runtime-health.service.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(WorkerModule.register({ runJobs: true, exposeHealth: true }));
  const logger = new Logger('WorkerBootstrap');
  await app.listen(Number(process.env.WORKER_PORT ?? 3001), '127.0.0.1');

  let stopping = false;
  const shutdown = async (): Promise<void> => {
    if (stopping) return;
    stopping = true;
    const graceMs = secondsFromEnv('WORKER_SHUTDOWN_GRACE_SECONDS', 20) * 1_000;
    logger.log(JSON.stringify({ service: 'worker', event: 'shutdown_requested', graceMs }));
    const forceExit = setTimeout(() => {
      logger.error(JSON.stringify({ service: 'worker', event: 'shutdown_grace_exceeded', graceMs }));
      process.exit(1);
    }, graceMs);
    try {
      await app.close();
      clearTimeout(forceExit);
      process.exitCode = 0;
    } catch (error) {
      clearTimeout(forceExit);
      logger.error(JSON.stringify({ service: 'worker', event: 'shutdown_failed', error: error instanceof Error ? error.message : 'Unknown error' }));
      process.exit(1);
    }
  };

  process.once('SIGINT', () => void shutdown());
  process.once('SIGTERM', () => void shutdown());
}

void bootstrap().catch((error: unknown) => {
  console.error(JSON.stringify({ service: 'worker', event: 'bootstrap_failed', error: error instanceof Error ? error.message : 'Unknown error' }));
  process.exitCode = 1;
});
