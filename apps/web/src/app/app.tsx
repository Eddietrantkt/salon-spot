import { useEffect, useState, type JSX, type MouseEvent } from 'react';
import type { AuthenticationResponse } from '@salon-spot/contracts';
import { DiscoveryPage } from '../features/discovery/pages/discovery-page';
import { WorkspaceBookingPage } from '../features/booking/pages/workspace-booking-page';
import { MyBookingsPage } from '../features/booking/pages/my-bookings-page';
import { OwnerConsolePage } from '../features/owner/pages/owner-console-page';
import { AdminConsolePage } from '../features/admin/pages/admin-console-page';
import { LoginPage, type LoginDestination } from '../features/auth/pages/login-page';
import { ProfessionalOnboardingPage } from '../features/professionals/pages/professional-onboarding-page';
import { logout } from '../features/auth/api/auth-api';
import { tomorrowInLocalCalendar } from '../shared/date/local-date';
import { LanguageSwitcher } from '../shared/i18n/language-switcher';
import { useI18n } from '../shared/i18n/i18n-provider';

type RouteName = 'discovery' | 'workspace' | 'bookings' | 'owner' | 'admin' | 'professional-onboarding' | 'login' | 'not-found';

interface Route {
  name: RouteName;
  pathname: string;
  search: URLSearchParams;
  workspaceId?: string;
}

export function App(): JSX.Element {
  const { t } = useI18n();
  const [route, setRoute] = useState<Route>(readRoute);
  const [session, setSession] = useState<AuthenticationResponse | null>(null);

  useEffect(() => {
    const onPopState = () => setRoute(readRoute());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  function navigate(to: string, replace = false): void {
    const next = normalizeInternalPath(to);
    if (next === `${window.location.pathname}${window.location.search}`) return;
    window.history[replace ? 'replaceState' : 'pushState']({}, '', next);
    setRoute(readRoute());
  }

  function openLogin(returnTo: string): void {
    navigate(`/login?${new URLSearchParams({ returnTo: normalizeInternalPath(returnTo) })}`);
  }

  async function signOut(): Promise<void> {
    try { await logout(); }
    finally { setSession(null); navigate('/'); }
  }

  const currentPath = `${route.pathname}${window.location.search}`;
  const content = renderRoute(route, currentPath, navigate, openLogin, setSession, session, t);

  return (
    <div className="app-frame">
      <header className="site-header">
        <NavigationLink className="brand" to="/" onNavigate={navigate}>The Salon Spot</NavigationLink>
        <nav className="app-nav" aria-label={t('Primary navigation', 'Điều hướng chính')}>
          <NavigationLink active={route.name === 'discovery' || route.name === 'workspace'} to="/" onNavigate={navigate}>{t('Explore', 'Khám phá')}</NavigationLink>
          <NavigationLink active={route.name === 'bookings'} to="/bookings" onNavigate={navigate}>{t('My bookings', 'Lịch đặt của tôi')}</NavigationLink>
          <NavigationLink active={route.name === 'owner'} to="/owner" onNavigate={navigate}>{t('Owner', 'Chủ salon')}</NavigationLink>
          <NavigationLink active={route.name === 'admin'} to="/admin" onNavigate={navigate}>{t('Admin', 'Quản trị')}</NavigationLink>
          {session ? <div className="account-status"><span aria-live="polite">{t('Hi', 'Xin chào')}, {session.user.displayName}</span><button className="text-button" type="button" onClick={() => void signOut()}>{t('Sign out', 'Đăng xuất')}</button></div> : <NavigationLink active={route.name === 'login'} to="/login" onNavigate={navigate}>{t('Sign in', 'Đăng nhập')}</NavigationLink>}
        </nav>
        <LanguageSwitcher />
      </header>
      {content}
      <nav className="mobile-nav" aria-label={t('Mobile navigation', 'Điều hướng di động')}>
        <NavigationLink active={route.name === 'discovery' || route.name === 'workspace'} to="/" onNavigate={navigate}>{t('Explore', 'Khám phá')}</NavigationLink>
        <NavigationLink active={route.name === 'bookings'} to="/bookings" onNavigate={navigate}>{t('Bookings', 'Lịch đặt')}</NavigationLink>
        <NavigationLink active={route.name === 'owner'} to="/owner" onNavigate={navigate}>{t('Owner', 'Chủ salon')}</NavigationLink>
        <NavigationLink active={route.name === 'admin'} to="/admin" onNavigate={navigate}>{t('Admin', 'Quản trị')}</NavigationLink>
        {session ? <button type="button" onClick={() => void signOut()}>{t('Sign out', 'Đăng xuất')}</button> : <NavigationLink active={route.name === 'login'} to="/login" onNavigate={navigate}>{t('Sign in', 'Đăng nhập')}</NavigationLink>}
      </nav>
    </div>
  );
}

function renderRoute(
  route: Route,
  currentPath: string,
  navigate: (to: string, replace?: boolean) => void,
  openLogin: (returnTo: string) => void,
  setSession: (session: AuthenticationResponse | null) => void,
  session: AuthenticationResponse | null,
  t: (english: string, vietnamese: string) => string
): JSX.Element {
  if (route.name === 'discovery') {
    const area = route.search.get('area')?.trim() ?? 'D1';
    const date = route.search.get('date') ?? tomorrowInLocalCalendar();
    const hasSearched = route.search.has('area') && route.search.has('date');
    return <DiscoveryPage
      key={currentPath}
      initialArea={area}
      initialDate={date}
      initialHasSearched={hasSearched}
      onSearchCommitted={(nextArea, nextDate) => navigate(`/?${new URLSearchParams({ area: nextArea, date: nextDate })}`)}
      onSelectWorkspace={(workspaceId, selectedArea, selectedDate) => navigate(`/workspaces/${encodeURIComponent(workspaceId)}?${new URLSearchParams({ area: selectedArea, date: selectedDate })}`)}
    />;
  }

  if (route.name === 'workspace' && route.workspaceId) {
    const date = route.search.get('date') ?? tomorrowInLocalCalendar();
    const area = route.search.get('area');
    const returnTo = area ? `/?${new URLSearchParams({ area, date })}` : '/';
    return <WorkspaceBookingPage workspaceId={route.workspaceId} date={date} onBack={() => navigate(returnTo)} onSignIn={() => openLogin(currentPath)} onSessionRestored={setSession} onSessionEnded={() => setSession(null)} />;
  }

  if (route.name === 'bookings') return <MyBookingsPage onSignIn={() => openLogin(currentPath)} onSessionRestored={setSession} onSessionEnded={() => setSession(null)} />;
  if (route.name === 'owner') return <OwnerConsolePage initialSession={session} onSignIn={() => openLogin(currentPath)} onSessionRestored={setSession} onSessionEnded={() => setSession(null)} />;
  if (route.name === 'admin') return <AdminConsolePage initialSession={session} onSignIn={() => openLogin(currentPath)} onSessionRestored={setSession} onSessionEnded={() => setSession(null)} />;
  if (route.name === 'professional-onboarding') return <ProfessionalOnboardingPage initialSession={session} onSessionRestored={setSession} onSessionEnded={() => setSession(null)} />;
  if (route.name === 'login') {
    const returnTo = safeReturnTo(route.search.get('returnTo'));
    return <LoginPage destination={destinationFor(returnTo)} onAuthenticated={(nextSession, registrationIntent) => { setSession(nextSession); navigate(registrationIntent === 'PROFESSIONAL' ? '/professional/onboarding' : registrationIntent === 'OWNER' ? '/owner' : returnTo, true); }} onBack={() => navigate('/')} />;
  }
  return <main className="page-shell"><h1>{t('Page not found', 'Không tìm thấy trang')}</h1><p className="lead">{t('This link does not point to an available Salon Spot page.', 'Liên kết này không dẫn đến một trang hiện có của Salon Spot.')}</p><button type="button" onClick={() => navigate('/')}>{t('Return to explore', 'Quay lại khám phá')}</button></main>;
}

function readRoute(): Route {
  const pathname = window.location.pathname.replace(/\/+$/, '') || '/';
  const search = new URLSearchParams(window.location.search);
  if (pathname === '/') return { name: 'discovery', pathname, search };
  if (pathname === '/bookings') return { name: 'bookings', pathname, search };
  if (pathname === '/owner') return { name: 'owner', pathname, search };
  if (pathname === '/admin') return { name: 'admin', pathname, search };
  if (pathname === '/professional/onboarding') return { name: 'professional-onboarding', pathname, search };
  if (pathname === '/login') return { name: 'login', pathname, search };
  const workspace = pathname.match(/^\/workspaces\/([^/]+)$/);
  if (workspace) return { name: 'workspace', pathname, search, workspaceId: decodeURIComponent(workspace[1]!) };
  return { name: 'not-found', pathname, search };
}

function safeReturnTo(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/';
  return normalizeInternalPath(value);
}

function normalizeInternalPath(value: string): string {
  return value.startsWith('/') && !value.startsWith('//') ? value : '/';
}

function destinationFor(returnTo: string): LoginDestination {
  if (returnTo.startsWith('/workspaces/')) return 'booking';
  if (returnTo === '/bookings') return 'my-bookings';
  if (returnTo === '/owner') return 'owner';
  if (returnTo === '/admin') return 'admin';
  return 'explore';
}

function NavigationLink({ active = false, className, to, onNavigate, children }: { active?: boolean; className?: string; to: string; onNavigate: (to: string) => void; children: string }): JSX.Element {
  function intercept(event: MouseEvent<HTMLAnchorElement>): void {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onNavigate(to);
  }
  return <a className={`${className ?? ''}${active ? ' nav-active' : ''}`.trim()} href={to} aria-current={active ? 'page' : undefined} onClick={intercept}>{children}</a>;
}
