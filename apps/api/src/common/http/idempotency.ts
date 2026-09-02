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

  for (let attempt = 0; attempt < 3; attempt += 1) {
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
      // A competing request can finish after this transaction's initial replay read
      // but before a lifecycle state check. Re-read before surfacing that conflict.
      const concurrentReplay = await findReplay<T>(prisma, actorUserId, scope, idempotencyKey, requestHash);
      if (concurrentReplay) return concurrentReplay;
      if (isRetryableTransactionConflict(error) && attempt < 2) {
        await delay((attempt + 1) * 20);
        continue;
      }
      throw error;
    }
  }
  throw new Error('Idempotency transaction retry limit was unexpectedly exhausted.');
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

/** MySQL may abort one contender rather than queue it; retrying is safe because this helper owns the idempotency record. */
function isRetryableTransactionConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code === 'P2034') return true;
  return error.code === 'P2010' && error.meta?.code === '1213';
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
