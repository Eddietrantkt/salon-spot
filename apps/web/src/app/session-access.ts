import type { AuthenticationResponse } from '@salon-spot/contracts';

export type NavigationDestination = 'discovery' | 'bookings' | 'notifications' | 'professional-onboarding' | 'owner' | 'admin' | 'login';

export function navigationDestinations(session: AuthenticationResponse | null): NavigationDestination[] {
  if (!session) return ['discovery', 'login'];

  const destinations: NavigationDestination[] = ['discovery'];
  if (session.capabilities.professionalStatus === 'ACTIVE') destinations.push('bookings');
  destinations.push('notifications');
  if (session.capabilities.professionalStatus) destinations.push('professional-onboarding');
  if (session.capabilities.owner) destinations.push('owner');
  if (session.capabilities.admin) destinations.push('admin');
  return destinations;
}

export function canAccessRoleRoute(
  destination: Exclude<NavigationDestination, 'discovery' | 'notifications' | 'login'>,
  session: AuthenticationResponse,
  hasFocusedBooking = false
): boolean {
  if (destination === 'owner') return session.capabilities.owner;
  if (destination === 'admin') return session.capabilities.admin;
  if (destination === 'professional-onboarding') return session.capabilities.professionalStatus !== null;
  return session.capabilities.professionalStatus === 'ACTIVE' || (hasFocusedBooking && session.capabilities.owner);
}
