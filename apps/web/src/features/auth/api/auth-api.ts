import type { AuthenticationResponse, RegistrationIntent } from '@salon-spot/contracts';
import { postJson } from '../../../shared/api/http';

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput extends LoginInput {
  displayName: string;
  onboardingIntent?: RegistrationIntent;
}

export function register(input: RegisterInput): Promise<AuthenticationResponse> {
  return postJson<AuthenticationResponse>('/auth/register', input);
}

export function login(input: LoginInput): Promise<AuthenticationResponse> {
  return postJson<AuthenticationResponse>('/auth/login', input);
}

export function enableOwner(accessToken: string): Promise<AuthenticationResponse> {
  return postJson<AuthenticationResponse>('/auth/owner-onboarding', {}, accessToken);
}

export function refreshSession(): Promise<AuthenticationResponse> {
  return postJson<AuthenticationResponse>('/auth/refresh', {});
}

export function logout(): Promise<void> {
  return postJson<void>('/auth/logout', {});
}
