import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { PrismaService } from '../database/prisma/prisma.service.js';

export function requireIdempotencyKey(value: string | string[] | undefined): string {
  if (typeof value !== 'string') throw new BadRequestException('Idempotency-Key header is required.');
  const key = value.trim();
  if (!key || key.length > 255) throw new BadRequestException('Idempotency-Key must contain 1 to 255 characters.');
  return key;
}

export async function executeIdempotently<T extends object>(
  prisma: PrismaService,
  actorUserId: string,
  scope: string,
  idempotencyKey: string,
  request: unknown,
  operation: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  const requestHash = createHash('sha256').update(JSON.stringify(request)).digest('hex');
  const replay = await findReplay<T>(prisma, actorUserId, scope, idempotencyKey, requestHash);
  if (replay) return replay;

  try {
    return await prisma.$transaction(async (tx) => {
      const inTransactionReplay = await findReplay<T>(tx, actorUserId, scope, idempotencyKey, requestHash);
      if (inTransactionReplay) return inTransactionReplay;
      const response = await operation(tx);
      await tx.idempotencyRecord.create({
        data: {
          actorUserId,
          scope,
          idempotencyKey,
          requestHash,
          statusCode: 201,
          responseBody: response as Prisma.InputJsonObject
        }
      });
      return response;
    });
  } catch (error) {
    if (!isUniqueIdempotencyViolation(error)) throw error;
    const concurrentReplay = await findReplay<T>(prisma, actorUserId, scope, idempotencyKey, requestHash);
    if (concurrentReplay) return concurrentReplay;
    throw error;
  }
}

async function findReplay<T extends object>(
  client: Pick<PrismaService, 'idempotencyRecord'> | Prisma.TransactionClient,
  actorUserId: string,
  scope: string,
  idempotencyKey: string,
  requestHash: string
): Promise<T | null> {
  const record = await client.idempotencyRecord.findUnique({
    where: { actorUserId_scope_idempotencyKey: { actorUserId, scope, idempotencyKey } },
    select: { requestHash: true, responseBody: true }
  });
  if (!record) return null;
  if (record.requestHash !== requestHash) {
    throw new ConflictException({ code: 'IDEMPOTENCY_CONFLICT', message: 'Idempotency-Key was already used with a different request.' });
  }
  return record.responseBody as T;
}

function isUniqueIdempotencyViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}
