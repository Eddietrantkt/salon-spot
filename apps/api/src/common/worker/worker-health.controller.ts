import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { WorkerRuntimeHealthService } from './worker-runtime-health.service.js';

@Controller('worker/health')
export class WorkerHealthController {
  constructor(private readonly runtime: WorkerRuntimeHealthService) {}

  @Get('live')
  getLiveness(): { status: 'ok'; service: 'salon-spot-worker'; timestamp: string } {
    return { status: 'ok', service: 'salon-spot-worker', timestamp: new Date().toISOString() };
  }

  @Get('ready')
  getReadiness(): { status: 'ok'; service: 'salon-spot-worker'; timestamp: string } {
    const runtime = this.runtime.snapshot();
    if (!runtime.ready) throw new ServiceUnavailableException({ message: 'Worker is not ready.', runtime });
    return { status: 'ok', service: 'salon-spot-worker', timestamp: new Date().toISOString() };
  }
}
