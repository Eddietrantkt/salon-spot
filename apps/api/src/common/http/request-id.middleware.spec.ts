import { RequestIdMiddleware } from './request-id.middleware.js';

describe('RequestIdMiddleware', () => {
  it('preserves a valid caller-supplied request ID and returns it in the response header', () => {
    const request = { headers: { 'x-request-id': 'request_123' } as Record<string, string | undefined> };
    const setHeader = jest.fn();
    const next = jest.fn();

    new RequestIdMiddleware().use(request, { setHeader }, next);

    expect(request).toMatchObject({ requestId: 'request_123' });
    expect(setHeader).toHaveBeenCalledWith('x-request-id', 'request_123');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('creates a request ID before continuing when the caller does not provide one', () => {
    const request: { headers: Record<string, string | undefined>; requestId?: string } = { headers: {} };
    const setHeader = jest.fn();

    new RequestIdMiddleware().use(request, { setHeader }, jest.fn());

    expect(request.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(setHeader).toHaveBeenCalledWith('x-request-id', request.requestId);
  });
});
