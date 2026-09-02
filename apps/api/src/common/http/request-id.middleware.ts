import { Injectable, type NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

interface RequestWithHeaders {
  headers: Record<string, string | string[] | undefined>;
  requestId?: string;
}

interface ResponseWithHeaders {
  setHeader(name: string, value: string): void;
}

/** Runs before guards so every API outcome can be correlated with one request ID. */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(request: RequestWithHeaders, response: ResponseWithHeaders, next: () => void): void {
    const suppliedId = request.headers['x-request-id'];
    const requestId = typeof suppliedId === 'string' && suppliedId.length > 0 && suppliedId.length <= 64
      ? suppliedId
      : randomUUID();

    request.requestId = requestId;
    response.setHeader('x-request-id', requestId);
    next();
  }
}
