import { useEffect, useState, type JSX, type MouseEvent, type ReactNode } from 'react';
import type { AuthenticationResponse } from '@salon-spot/contracts';
import { DiscoveryPage } from '../features/discovery/pages/discovery-page';
import { WorkspaceBookingPage } from '../features/booking/pages/workspace-booking-page';
import { MyBookingsPage } from '../features/booking/pages/my-bookings-page';
import { OwnerConsolePage } from '../features/owner/pages/owner-console-page';
import { AdminConsolePage } from '../features/admin/pages/admin-console-page';
import { LoginPage, type LoginDestination } from '../features/auth/pages/login-page';
import { ProfessionalOnboardingPage } from '../features/professionals/pages/professional-onboarding-page';
import { NotificationsPage } from '../features/notifications/pages/notifications-page';
import { getNotificationUnreadCount } from '../features/notifications/api/notifications-api';
import { notificationTargetPath } from '../features/notifications/notification-copy';
import { logout, refreshSession } from '../features/auth/api/auth-api';
import { ApiRequestError } from '../shared/api/http';
import { tomorrowInLocalCalendar } from '../shared/date/local-date';
import { LanguageSwitcher } from '../shared/i18n/language-switcher';
import { useI18n } from '../shared/i18n/i18n-provider';
import { canAccessRoleRoute, navigationDestinations } from './session-access';
import { Icon } from '../shared/ui/icon';

type RouteName = 'discovery' | 'workspace' | 'bookings' | 'notifications' | 'owner' | 'admin' | 'professional-onboarding' | 'login' | 'not-found';

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
  const [isSessionResolved, setIsSessionResolved] = useState(false);
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(0);

  useEffect(() => {
    const onPopState = () => setRoute(readRoute());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    let active = true;
    void refreshSession()
      .then((restored) => { if (active) setSession(restored); })
      .catch((reason) => {
        if (active && !(reason instanceof ApiRequestError && reason.status === 401)) console.error(reason);
      })
      .finally(() => { if (active) setIsSessionResolved(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!session) { setNotificationUnreadCount(0); return; }
    let active = true;
    void getNotificationUnreadCount(session.accessToken)
      .then((response) => { if (active) setNotificationUnreadCount(response.unreadCount); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [session]);

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
    finally { setSession(null); setNotificationUnreadCount(0); navigate('/'); }
  }

  const currentPath = `${route.pathname}${window.location.search}`;
  const content = renderRoute(route, currentPath, navigate, openLogin, setSession, session, isSessionResolved, setNotificationUnreadCount, t);
  const notificationLabel = `${t('Notifications', 'Thông báo')}${notificationUnreadCount > 0 ? ` (${notificationUnreadCount > 99 ? '99+' : notificationUnreadCount})` : ''}`;
  const navigation = navigationDestinations(session);

  return (
    <div className="app-frame">
      <header className="site-header">
        <NavigationLink className="brand" to="/" onNavigate={navigate}>The Salon Spot</NavigationLink>
        <nav className="app-nav" aria-label={t('Primary navigation', 'Điều hướng chính')}>
          <NavigationLink active={route.name === 'discovery' || route.name === 'workspace'} to="/" onNavigate={navigate}>{t('Explore', 'Khám phá')}</NavigationLink>
          {navigation.includes('bookings') && <NavigationLink active={route.name === 'bookings'} to="/bookings" onNavigate={navigate}>{t('My bookings', 'Lịch đặt của tôi')}</NavigationLink>}
          {navigation.includes('notifications') && <NavigationLink active={route.name === 'notifications'} to="/notifications" onNavigate={navigate}>{notificationLabel}</NavigationLink>}
          {(navigation.includes('professional-onboarding') || navigation.includes('owner') || navigation.includes('admin')) && <details className="nav-more" open={route.name === 'professional-onboarding' || route.name === 'owner' || route.name === 'admin'}><summary>{t('Workspace', 'Khu vực')}</summary><div className="nav-more-menu">
            {navigation.includes('professional-onboarding') && <NavigationLink active={route.name === 'professional-onboarding'} to="/professional/onboarding" onNavigate={navigate}><Icon name="user" size={16} />{t('Professional profile', 'Hồ sơ chuyên viên')}</NavigationLink>}
            {navigation.includes('owner') && <NavigationLink active={route.name === 'owner'} to="/owner" onNavigate={navigate}><Icon name="store" size={16} />{t('Owner', 'Chủ salon')}</NavigationLink>}
            {navigation.includes('admin') && <NavigationLink active={route.name === 'admin'} to="/admin" onNavigate={navigate}><Icon name="shield" size={16} />{t('Admin', 'Quản trị')}</NavigationLink>}
          </div></details>}
          {session ? <div className="account-status"><span aria-live="polite"><strong>{t('Hi', 'Xin chào')}, {session.user.displayName}</strong><small>{accountContext(session, route.name, t)}</small></span><button className="text-button" type="button" onClick={() => void signOut()}>{t('Sign out', 'Đăng xuất')}</button></div> : navigation.includes('login') && <NavigationLink active={route.name === 'login'} to="/login" onNavigate={navigate}>{t('Sign in', 'Đăng nhập')}</NavigationLink>}
        </nav>
        <LanguageSwitcher />
      </header>
      {content}
      <footer className="site-footer"><p><strong>The Salon Spot</strong> · {t('A calmer way to find a ready-to-work beauty space.', 'Cách nhẹ nhàng hơn để tìm không gian làm đẹp sẵn sàng làm việc.')}</p><span>{t('Availability, local time and booking details are shown before you confirm.', 'Lịch trống, giờ địa phương và chi tiết lịch đặt luôn được hiển thị trước khi xác nhận.')}</span></footer>
      <nav className="mobile-nav" aria-label={t('Mobile navigation', 'Điều hướng di động')}>
        <NavigationLink active={route.name === 'discovery' || route.name === 'workspace'} to="/" onNavigate={navigate}><span className="nav-item-content"><span className="mobile-nav-icon"><Icon name="compass" size={19} /></span><span>{t('Explore', 'Khám phá')}</span></span></NavigationLink>
        {navigation.includes('bookings') && <NavigationLink active={route.name === 'bookings'} to="/bookings" onNavigate={navigate}><span className="nav-item-content"><span className="mobile-nav-icon"><Icon name="calendar-check" size={19} /></span><span>{t('Bookings', 'Lịch đặt')}</span></span></NavigationLink>}
        {navigation.includes('notifications') && <NavigationLink active={route.name === 'notifications'} to="/notifications" onNavigate={navigate}><span className="nav-item-content"><span className="mobile-nav-icon"><Icon name="bell" size={19} /></span><span>{t('Alerts', 'Tin báo')}</span></span>{notificationUnreadCount > 0 && <span className="mobile-nav-badge" aria-label={`${notificationUnreadCount} ${t('unread notifications', 'thông báo chưa đọc')}`}>{notificationUnreadCount > 99 ? '99+' : notificationUnreadCount}</span>}</NavigationLink>}
        {navigation.includes('professional-onboarding') && <NavigationLink active={route.name === 'professional-onboarding'} to="/professional/onboarding" onNavigate={navigate}><span className="nav-item-content"><span className="mobile-nav-icon"><Icon name="user" size={19} /></span><span>{t('Profile', 'Hồ sơ')}</span></span></NavigationLink>}
        {navigation.includes('owner') && <NavigationLink active={route.name === 'owner'} to="/owner" onNavigate={navigate}><span className="nav-item-content"><span className="mobile-nav-icon"><Icon name="store" size={19} /></span><span>{t('Owner', 'Chủ salon')}</span></span></NavigationLink>}
        {navigation.includes('admin') && <NavigationLink active={route.name === 'admin'} to="/admin" onNavigate={navigate}><span className="nav-item-content"><span className="mobile-nav-icon"><Icon name="shield" size={19} /></span><span>{t('Admin', 'Quản trị')}</span></span></NavigationLink>}
        {session ? <button type="button" onClick={() => void signOut()}><span className="nav-item-content"><span className="mobile-nav-icon"><Icon name="user" size={19} /></span><span>{t('Sign out', 'Đăng xuất')}</span></span></button> : navigation.includes('login') && <NavigationLink active={route.name === 'login'} to="/login" onNavigate={navigate}><span className="nav-item-content"><span className="mobile-nav-icon"><Icon name="user" size={19} /></span><span>{t('Sign in', 'Đăng nhập')}</span></span></NavigationLink>}
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
  isSessionResolved: boolean,
  setNotificationUnreadCount: (count: number) => void,
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
    return <WorkspaceBookingPage workspaceId={route.workspaceId} date={date} initialSession={session} sessionResolved={isSessionResolved} onBack={() => navigate(returnTo)} onDateChange={(nextDate) => navigate(workspacePath(route.workspaceId!, area, nextDate))} onSignIn={() => openLogin(currentPath)} onSessionRestored={setSession} onSessionEnded={() => setSession(null)} />;
  }

  if (route.name === 'bookings') {
    const focusBookingId = route.search.get('bookingId') ?? undefined;
    if (!isSessionResolved) return <SessionLoadingPage t={t} />;
    if (!session) return <SignInRequiredPage destination="bookings" onSignIn={() => openLogin(currentPath)} onExplore={() => navigate('/')} t={t} />;
    if (!canAccessRoleRoute('bookings', session, Boolean(focusBookingId))) return <RoleAccessDeniedPage onExplore={() => navigate('/')} t={t} />;
    return <MyBookingsPage initialSession={session} focusBookingId={focusBookingId} onSignIn={() => openLogin(currentPath)} onSessionRestored={setSession} onSessionEnded={() => setSession(null)} />;
  }
  if (route.name === 'notifications') {
    if (!isSessionResolved) return <SessionLoadingPage t={t} />;
    if (!session) return <SignInRequiredPage destination="notifications" onSignIn={() => openLogin(currentPath)} onExplore={() => navigate('/')} t={t} />;
    return <NotificationsPage initialSession={session} onSignIn={() => openLogin(currentPath)} onSessionRestored={setSession} onSessionEnded={() => setSession(null)} onUnreadCountChange={setNotificationUnreadCount} onOpenNotification={(notification) => navigate(notificationTargetPath(notification))} />;
  }
  if (route.name === 'owner') {
    if (!isSessionResolved) return <SessionLoadingPage t={t} />;
    if (!session) return <SignInRequiredPage destination="owner" onSignIn={() => openLogin(currentPath)} onExplore={() => navigate('/')} t={t} />;
    if (!canAccessRoleRoute('owner', session)) return <RoleAccessDeniedPage onExplore={() => navigate('/')} t={t} />;
    return <OwnerConsolePage initialSession={session} onSignIn={() => openLogin(currentPath)} onSessionRestored={setSession} onSessionEnded={() => setSession(null)} />;
  }
  if (route.name === 'admin') {
    if (!isSessionResolved) return <SessionLoadingPage t={t} />;
    if (!session) return <SignInRequiredPage destination="admin" onSignIn={() => openLogin(currentPath)} onExplore={() => navigate('/')} t={t} />;
    if (!canAccessRoleRoute('admin', session)) return <RoleAccessDeniedPage onExplore={() => navigate('/')} t={t} />;
    return <AdminConsolePage initialSession={session} onSignIn={() => openLogin(currentPath)} onSessionRestored={setSession} onSessionEnded={() => setSession(null)} />;
  }
  if (route.name === 'professional-onboarding') {
    if (!isSessionResolved) return <SessionLoadingPage t={t} />;
    if (!session) return <SignInRequiredPage destination="professional" onSignIn={() => openLogin(currentPath)} onExplore={() => navigate('/')} t={t} />;
    if (!canAccessRoleRoute('professional-onboarding', session)) return <RoleAccessDeniedPage onExplore={() => navigate('/')} t={t} />;
    return <ProfessionalOnboardingPage initialSession={session} onSessionRestored={setSession} onSessionEnded={() => setSession(null)} />;
  }
  if (route.name === 'login') {
    const returnTo = safeReturnTo(route.search.get('returnTo'));
    return <LoginPage destination={destinationFor(returnTo)} onAuthenticated={(nextSession, registrationIntent) => { setSession(nextSession); navigate(registrationIntent === 'PROFESSIONAL' ? '/professional/onboarding' : registrationIntent === 'OWNER' ? '/owner' : returnTo, true); }} onBack={() => navigate('/')} />;
  }
  return <main className="page-shell"><h1>{t('Page not found', 'Không tìm thấy trang')}</h1><p className="lead">{t('This link does not point to an available Salon Spot page.', 'Liên kết này không dẫn đến một trang hiện có của Salon Spot.')}</p><button type="button" onClick={() => navigate('/')}>{t('Return to explore', 'Quay lại khám phá')}</button></main>;
}

type Translate = (english: string, vietnamese: string) => string;

function SessionLoadingPage({ t }: { t: Translate }): JSX.Element {
  return <main className="page-shell access-shell"><section className="access-card" aria-busy="true"><p className="eyebrow">THE SALON SPOT</p><h1>{t('Restoring your account…', 'Đang khôi phục tài khoản…')}</h1><p className="lead">{t('We are checking the secure session on this device.', 'Hệ thống đang kiểm tra phiên bảo mật trên thiết bị này.')}</p></section></main>;
}

function SignInRequiredPage({ destination, onSignIn, onExplore, t }: { destination: 'bookings' | 'notifications' | 'professional' | 'owner' | 'admin'; onSignIn: () => void; onExplore: () => void; t: Translate }): JSX.Element {
  const labels = {
    bookings: t('your bookings', 'lịch đặt của bạn'),
    notifications: t('notifications', 'thông báo'),
    professional: t('your Professional profile', 'hồ sơ Chuyên viên'),
    owner: t('the Owner portal', 'khu vực Chủ salon'),
    admin: t('the Admin portal', 'khu vực Quản trị')
  };
  return <main className="page-shell access-shell"><section className="access-card"><p className="eyebrow">{t('ACCOUNT REQUIRED', 'YÊU CẦU TÀI KHOẢN')}</p><h1>{t(`Sign in to open ${labels[destination]}`, `Đăng nhập để mở ${labels[destination]}`)}</h1><p className="lead">{t('Guest access is limited to Explore. After sign-in, navigation is personalized to the capabilities assigned to your account.', 'Khách chỉ có thể sử dụng phần Khám phá. Sau khi đăng nhập, điều hướng sẽ được cá nhân hoá theo quyền được cấp cho tài khoản.')}</p><div className="access-actions"><button type="button" onClick={onSignIn}>{t('Sign in', 'Đăng nhập')}</button><button className="text-button" type="button" onClick={onExplore}>{t('Back to Explore', 'Quay lại Khám phá')}</button></div></section></main>;
}

function RoleAccessDeniedPage({ onExplore, t }: { onExplore: () => void; t: Translate }): JSX.Element {
  return <main className="page-shell access-shell"><section className="access-card"><p className="eyebrow">{t('ACCESS LIMITED', 'GIỚI HẠN TRUY CẬP')}</p><h1>{t('This area is not assigned to your account', 'Khu vực này không thuộc quyền của tài khoản')}</h1><p className="lead">{t('Only accounts with the matching server-issued capability can open this area. Your current session is still active.', 'Chỉ tài khoản có đúng quyền do máy chủ cấp mới có thể mở khu vực này. Phiên đăng nhập hiện tại của bạn vẫn được giữ nguyên.')}</p><div className="access-actions"><button type="button" onClick={onExplore}>{t('Return to Explore', 'Quay lại Khám phá')}</button></div></section></main>;
}

function accountContext(session: AuthenticationResponse, routeName: RouteName, t: Translate): string {
  if (routeName === 'admin' && session.capabilities.admin) return t('Admin workspace', 'Khu vực Quản trị');
  if (routeName === 'owner' && session.capabilities.owner) return t('Owner workspace', 'Khu vực Chủ salon');
  if (session.capabilities.professionalStatus) return t('Professional account', 'Tài khoản Chuyên viên');
  if (session.capabilities.admin) return t('Admin account', 'Tài khoản Quản trị');
  if (session.capabilities.owner) return t('Owner account', 'Tài khoản Chủ salon');
  return t('Signed-in account', 'Tài khoản đã đăng nhập');
}

function readRoute(): Route {
  const pathname = window.location.pathname.replace(/\/+$/, '') || '/';
  const search = new URLSearchParams(window.location.search);
  if (pathname === '/') return { name: 'discovery', pathname, search };
  if (pathname === '/bookings') return { name: 'bookings', pathname, search };
  if (pathname === '/notifications') return { name: 'notifications', pathname, search };
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

function workspacePath(workspaceId: string, area: string | null, date: string): string {
  const search = new URLSearchParams({ date });
  if (area) search.set('area', area);
  return `/workspaces/${encodeURIComponent(workspaceId)}?${search}`;
}

function destinationFor(returnTo: string): LoginDestination {
  if (returnTo.startsWith('/workspaces/')) return 'booking';
  if (returnTo.startsWith('/bookings')) return 'my-bookings';
  if (returnTo === '/notifications') return 'my-bookings';
  if (returnTo === '/owner') return 'owner';
  if (returnTo === '/admin') return 'admin';
  return 'explore';
}

function NavigationLink({ active = false, className, to, onNavigate, children }: { active?: boolean; className?: string; to: string; onNavigate: (to: string) => void; children: ReactNode }): JSX.Element {
  function intercept(event: MouseEvent<HTMLAnchorElement>): void {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onNavigate(to);
  }
  return <a className={`${className ?? ''}${active ? ' nav-active' : ''}`.trim()} href={to} aria-current={active ? 'page' : undefined} onClick={intercept}>{children}</a>;
}
