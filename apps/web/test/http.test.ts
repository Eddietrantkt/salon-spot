import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiRequestError, postJson } from '../src/shared/api/http.ts';

test('turns an unresponsive API request into a connection error', { timeout: 250 }, async () => {
  const originalFetch = globalThis.fetch;
  const originalSetTimeout = globalThis.setTimeout;
  let receivedSignal: AbortSignal | undefined;

  globalThis.setTimeout = ((callback: TimerHandler) => {
    queueMicrotask(() => {
      if (typeof callback === 'function') callback();
    });
    return 1 as unknown as ReturnType<typeof setTimeout>;
  }) as typeof setTimeout;
  globalThis.fetch = ((_input: RequestInfo | URL, init?: RequestInit) => {
    receivedSignal = init?.signal ?? undefined;
    return new Promise<Response>((_resolve, reject) => {
      receivedSignal?.addEventListener('abort', () => reject(new DOMException('Request timed out', 'AbortError')), { once: true });
    });
  }) as typeof fetch;

  try {
    await assert.rejects(
      () => postJson('/auth/login', { email: 'member@example.com', password: 'password-123' }),
      (reason: unknown) => reason instanceof ApiRequestError && reason.status === 0
    );
    assert.ok(receivedSignal, 'the request must receive a timeout signal');
    assert.equal(receivedSignal.aborted, true);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.setTimeout = originalSetTimeout;
  }
});
