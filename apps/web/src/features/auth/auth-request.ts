import type { LoginInput, RegisterInput } from './api/auth-api';

export type AuthenticationMode = 'login' | 'register';

export type AuthenticationRequest =
  | { mode: 'login'; input: LoginInput }
  | { mode: 'register'; input: RegisterInput };

export function buildAuthenticationRequest(mode: AuthenticationMode, fields: RegisterInput): AuthenticationRequest {
  if (mode === 'register') return { mode, input: fields };
  return { mode, input: { email: fields.email, password: fields.password } };
}
