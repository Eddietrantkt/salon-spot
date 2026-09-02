import { ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../database/prisma/prisma.service.js';
import { HealthService } from './health.service.js';

describe('HealthService', () => {
  afterEach(() => jest.useRealTimers());

  it('keeps the established public health contract for liveness', () => {
    const result = new HealthService().getHealth();
    expect(result.status).toBe('ok');
    expect(result.service).toBe('salon-spot-api');
    expect(Number.isNaN(Date.parse(result.timestamp))).toBe(false);
  });

  it('is ready only after a real Prisma query succeeds', async () => {
    const prisma = { $queryRawUnsafe: jest.fn().mockResolvedValue([{ 1: 1 }]) } as unknown as PrismaService;
    await expect(new HealthService(prisma).getReadiness()).resolves.toMatchObject({ status: 'ok', service: 'salon-spot-api' });
  });

  it('returns unavailable when the database query fails', async () => {
    const prisma = { $queryRawUnsafe: jest.fn().mockRejectedValue(new Error('connection refused')) } as unknown as PrismaService;
    await expect(new HealthService(prisma).getReadiness()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('bounds database readiness with a timeout', async () => {
    jest.useFakeTimers();
    process.env.HEALTH_DB_TIMEOUT_MS = '10';
    const prisma = { $queryRawUnsafe: jest.fn().mockReturnValue(new Promise(() => undefined)) } as unknown as PrismaService;
    const readiness = new HealthService(prisma).getReadiness();
    const assertion = expect(readiness).rejects.toBeInstanceOf(ServiceUnavailableException);
    await jest.advanceTimersByTimeAsync(10);
    await assertion;
    delete process.env.HEALTH_DB_TIMEOUT_MS;
  });
});
