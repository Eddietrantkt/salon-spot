import type { ProfessionalProfile, UpdateProfessionalProfileInput } from '@salon-spot/contracts';
import { authenticatedGetJson, patchJson } from '../../../shared/api/http';

export function getProfessionalProfile(accessToken: string): Promise<ProfessionalProfile> {
  return authenticatedGetJson<ProfessionalProfile>('/professionals/me', accessToken);
}

export function updateProfessionalProfile(accessToken: string, input: UpdateProfessionalProfileInput): Promise<ProfessionalProfile> {
  return patchJson<ProfessionalProfile>('/professionals/me', input, accessToken);
}
