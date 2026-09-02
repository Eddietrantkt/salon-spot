import type {
  AdminAuditEventsResponse,
  AdminOutboxEventsResponse,
  AdminOverviewResponse,
  AdminUsersResponse,
  UpdateAdminUserStatusResponse
} from '@salon-spot/contracts';
import { authenticatedGetJson, postJson, putJson } from '../../../shared/api/http';

export function getAdminOverview(accessToken: string): Promise<AdminOverviewResponse> {
  return authenticatedGetJson<AdminOverviewResponse>('/admin/overview', accessToken);
}

export function getAdminUsers(accessToken: string, search = ''): Promise<AdminUsersResponse> {
  const query = new URLSearchParams({ page: '1', pageSize: '50' });
  if (search.trim()) query.set('search', search.trim());
  return authenticatedGetJson<AdminUsersResponse>(`/admin/users?${query.toString()}`, accessToken);
}

export function getAdminAuditEvents(accessToken: string): Promise<AdminAuditEventsResponse> {
  return authenticatedGetJson<AdminAuditEventsResponse>('/admin/audit-events', accessToken);
}

export function getAdminOutboxEvents(accessToken: string): Promise<AdminOutboxEventsResponse> {
  return authenticatedGetJson<AdminOutboxEventsResponse>('/admin/outbox-events', accessToken);
}

export function updateAdminUserStatus(accessToken: string, userId: string, status: 'ACTIVE' | 'SUSPENDED', reason: string, idempotencyKey: string): Promise<UpdateAdminUserStatusResponse> {
  return putJson<UpdateAdminUserStatusResponse>(`/admin/users/${encodeURIComponent(userId)}/status`, { status, reason }, accessToken, idempotencyKey);
}
