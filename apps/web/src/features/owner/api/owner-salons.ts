import type {
  CreateSalonWithWorkspaceInput,
  CreateSalonWithWorkspaceResponse,
  CreateWorkspaceInput,
  CreateWorkspaceResponse,
  OwnerSalon
} from '@salon-spot/contracts';
import { authenticatedGetJson, postJson } from '../../../shared/api/http';

export function getOwnedSalons(accessToken: string): Promise<OwnerSalon[]> {
  return authenticatedGetJson<OwnerSalon[]>('/owner/salons', accessToken);
}

export function createSalonWithWorkspace(accessToken: string, input: CreateSalonWithWorkspaceInput, idempotencyKey: string): Promise<CreateSalonWithWorkspaceResponse> {
  return postJson<CreateSalonWithWorkspaceResponse>('/owner/salons', input, accessToken, idempotencyKey);
}

export function createAdditionalWorkspace(accessToken: string, salonId: string, input: CreateWorkspaceInput, idempotencyKey: string): Promise<CreateWorkspaceResponse> {
  return postJson<CreateWorkspaceResponse>(`/owner/salons/${encodeURIComponent(salonId)}/workspaces`, input, accessToken, idempotencyKey);
}
