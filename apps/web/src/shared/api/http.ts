// Production nginx proxies this relative path to the API, keeping refresh cookies same-origin.
export const apiBaseUrl = import.meta.env.VITE_API_URL ?? '/api/v1';

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly requestId?: string
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

export async function getJson<T>(path: string): Promise<T> {
  return requestJson<T>(path, { headers: { Accept: 'application/json' } });
}

export async function authenticatedGetJson<T>(path: string, accessToken: string): Promise<T> {
  return requestJson<T>(path, { headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` } });
}

export async function postJson<T>(path: string, body: unknown, accessToken?: string, idempotencyKey?: string): Promise<T> {
  return requestJson<T>(path, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {})
    },
    body: JSON.stringify(body)
  });
}

export async function putJson<T>(path: string, body: unknown, accessToken: string, idempotencyKey?: string): Promise<T> {
  return requestJson<T>(path, {
    method: 'PUT',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {})
    },
    body: JSON.stringify(body)
  });
}

export async function patchJson<T>(path: string, body: unknown, accessToken: string, idempotencyKey?: string): Promise<T> {
  return requestJson<T>(path, {
    method: 'PATCH',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {})
    },
    body: JSON.stringify(body)
  });
}

export async function deleteJson<T>(path: string, accessToken: string): Promise<T> {
  return requestJson<T>(path, { method: 'DELETE', headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` } });
}

async function requestJson<T>(path: string, init: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, { ...init, credentials: 'include' });
  } catch {
    throw new ApiRequestError('We could not reach the service. Check your connection and try again.', 0);
  }
  if (!response.ok) {
    const fallback = 'We could not complete that request. Please try again.';
    const payload: unknown = await response.json().catch(() => null);
    const message = payload && typeof payload === 'object' && 'message' in payload
      ? (Array.isArray(payload.message) ? payload.message[0] : payload.message)
      : fallback;
    const code = payload && typeof payload === 'object' && 'code' in payload && typeof payload.code === 'string' ? payload.code : undefined;
    const requestId = payload && typeof payload === 'object' && 'requestId' in payload && typeof payload.requestId === 'string'
      ? payload.requestId
      : response.headers.get('x-request-id') ?? undefined;
    throw new ApiRequestError(typeof message === 'string' ? message : fallback, response.status, code, requestId);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
