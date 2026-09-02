import { Controller, Get } from '@nestjs/common';
import type { HealthResponse } from '@salon-spot/contracts';
import { HealthService } from './health.service.js';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  getHealth(): HealthResponse {
    return this.healthService.getHealth();
  }

  @Get('live')
  getLiveness(): HealthResponse {
    return this.healthService.getLiveness();
  }

  @Get('ready')
  getReadiness(): Promise<HealthResponse> {
    return this.healthService.getReadiness();
  }
}
