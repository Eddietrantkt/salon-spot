import type { WorkspaceSearchResponse } from '@salon-spot/contracts';
import { getJson } from '../../../shared/api/http';

export function searchWorkspaces(area: string, date: string): Promise<WorkspaceSearchResponse> {
  const params = new URLSearchParams({ area, date });
  return getJson<WorkspaceSearchResponse>(`/workspaces?${params.toString()}`);
}
