import { Injectable, Optional, ServiceUnavailableException } from '@nestjs/common';
import type { HealthResponse } from '@salon-spot/contracts';
import { PrismaService } from '../database/prisma/prisma.service.js';

@Injectable()
export class HealthService {
  constructor(@Optional() private readonly prisma?: PrismaService) {}

  getHealth(): HealthResponse {
    return { status: 'ok', service: 'salon-spot-api', timestamp: new Date().toISOString() };
  }

  /** Process liveness deliberately has no database dependency. */
  getLiveness(): HealthResponse {
    return this.getHealth();
  }

  /** Readiness proves this API process can make a bounded real query to MySQL. */
  async getReadiness(): Promise<HealthResponse> {
    if (!this.prisma) throw new ServiceUnavailableException('Database health check is not configured.');
    const timeoutMs = positiveInteger(process.env.HEALTH_DB_TIMEOUT_MS, 3_000);
    let timeout: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        this.prisma.$queryRawUnsafe('SELECT 1'),
        new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error(`Database health check timed out after ${timeoutMs}ms.`)), timeoutMs); })
      ]);
      return this.getHealth();
    } catch {
      throw new ServiceUnavailableException('Database is not ready.');
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
