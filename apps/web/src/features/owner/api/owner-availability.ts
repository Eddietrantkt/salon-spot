import type {
  BlockWorkspaceSlotsInput,
  BlockWorkspaceSlotsResponse,
  OpenWorkspaceSlotsInput,
  OpenWorkspaceSlotsResponse,
  OwnerWorkspaceScheduleResponse
} from '@salon-spot/contracts';
import { authenticatedGetJson, postJson } from '../../../shared/api/http';

export function getWorkspaceSchedule(
  accessToken: string,
  salonId: string,
  workspaceId: string,
  localDate: string
): Promise<OwnerWorkspaceScheduleResponse> {
  return authenticatedGetJson(`${availabilityPath(salonId, workspaceId)}/fixed-slots?localDate=${encodeURIComponent(localDate)}`, accessToken);
}

export function openWorkspaceSlots(
  accessToken: string,
  salonId: string,
  workspaceId: string,
  input: OpenWorkspaceSlotsInput,
  idempotencyKey: string
): Promise<OpenWorkspaceSlotsResponse> {
  return postJson(`${availabilityPath(salonId, workspaceId)}/open-fixed-slots`, input, accessToken, idempotencyKey);
}

export function blockWorkspaceSlots(
  accessToken: string,
  salonId: string,
  workspaceId: string,
  input: BlockWorkspaceSlotsInput,
  idempotencyKey: string
): Promise<BlockWorkspaceSlotsResponse> {
  return postJson(`${availabilityPath(salonId, workspaceId)}/block-fixed-slots`, input, accessToken, idempotencyKey);
}

function availabilityPath(salonId: string, workspaceId: string): string {
  return `/owner/salons/${encodeURIComponent(salonId)}/workspaces/${encodeURIComponent(workspaceId)}/availability`;
}
